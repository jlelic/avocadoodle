import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import * as colorString from 'color-string';

import * as DrawMessage from '../../../shared/messages/draw-message';
import * as StartRoundMessage from '../../../shared/messages/start-round-message';
import * as EndRoundMessage from '../../../shared/messages/end-round-message';
import * as GameOverMessage from '../../../shared/messages/game-over-message';
import * as TimerMessage from '../../../shared/messages/timer-message';
import * as WordMessage from '../../../shared/messages/word-message';
import * as WordChoicesMessage from '../../../shared/messages/word-choices-message';

import { CommunicationService } from '../core/communication.service';
import { PlayersService } from '../core/players.service';
import { SoundsService } from '../core/sounds.service';
import { DiscordService } from '../core/discord/discord.service';
import { ChatService } from '../core/chat/chat.service';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent implements OnInit, OnDestroy {
  @ViewChild('canvas') canvas: ElementRef;

  messageSubscription: Subscription;
  context: CanvasRenderingContext2D;
  width = 800;
  height = 600;
  isMouseDown = false;
  isOverCanvas = false;
  startedClickOnCanvas = false;
  prevX: number = null;
  prevY: number = null;
  word = '';
  words: string[] = null;
  time = 0;
  round = 0;

  thickness = 1;
  color: string = 'black';
  tool: string = 'brush';
  isPlaying = false;
  roundResults = null;
  gameResults = null;
  drawHistory = [];
  lastShared;

  mouseDownListener;
  mouseUpListener;
  mouseMoveListener;


  constructor(private chat: ChatService,
              private communication: CommunicationService,
              private discord: DiscordService,
              private players: PlayersService,
              private sounds: SoundsService) {
  }

  get name() {
    return this.communication.name;
  }

  get drawingPlayerName() {
    return this.players.drawing;
  }

  get canDraw() {
    return !this.isPlaying || this.name == this.drawingPlayerName;
  }

  ngOnInit() {
    this.communication.init();

    const canvas = this.canvas.nativeElement;
    canvas.height = this.height;
    canvas.width = this.width;

    // fuck me
    this.mouseDownListener = this.onMouseDown.bind(this);
    this.mouseUpListener = this.onMouseUp.bind(this);
    this.mouseMoveListener = this.onMouseMove.bind(this);
    window.addEventListener('mousedown', this.mouseDownListener);
    window.addEventListener('mouseup', this.mouseUpListener);
    window.addEventListener('mousemove', this.mouseMoveListener);

    this.context = canvas.getContext('2d');
    this.context.imageSmoothingEnabled = false;
    this.clearCanvas();
    this.drawHistory = [];
    this.messageSubscription = this.communication.incomingMessages.subscribe(({ type, data }) => {
      switch (type) {
        case DrawMessage.type:
          this.processDrawMessage(data);
          break;
        case StartRoundMessage.type:
          this.words = null;
          this.roundResults = null;
          this.gameResults = null;
          this.isPlaying = true;
          this.word = data.word;
          this.round = data.round;
          this.clearCanvas();
          this.drawHistory = [];
          break;
        case EndRoundMessage.type:
          this.isPlaying = false;
          this.roundResults = this.processRoundResults(data.results);
          if (data.results[this.players.drawing] < 0) {
            this.sounds.playLoss();
          } else if (this.roundResults.filter(({ score }) => score == 0).length == 1) {
            this.sounds.playOneLeft();
          }
          this.word = data.word;
          break;
        case TimerMessage.type:
          this.time = data.time;
          break;
        case WordMessage.type:
          this.word = data.word;
          break;
        case WordChoicesMessage.type:
          this.sounds.playChooseWord();
          this.words = data.words;
          this.gameResults = null;
          this.roundResults = null;
          break;
        case GameOverMessage.type:
          this.gameResults = this.players.players;
          this.words = null;
          this.roundResults = null;
          this.round = 0;
          break;
      }
    });
  }

  ngOnDestroy() {
    this.drawHistory = [];
    window.removeEventListener('mousedown', this.mouseDownListener);
    window.removeEventListener('mouseup', this.mouseUpListener);
    window.removeEventListener('mousemove', this.mouseMoveListener);
    this.communication.disconnect();
    this.messageSubscription.unsubscribe();
  }

  bucketTool(startX: number, startY: number, color) {
    const colorEq = (data, color, b) => {
      return color[0] === data.data[b]
        && color[1] === data.data[b + 1]
        && color[2] === data.data[b + 2]
        && color[3] === data.data[b + 3]
    };

    const getIndex = (x, y, width) => y * (width * 4) + x * 4;

    const [r, g, b, _] = colorString.get.rgb(color);
    const a = 255;
    const ctx = this.context;
    const fillData = ctx.createImageData(1, 1);
    fillData.data[0] = r;
    fillData.data[1] = g;
    fillData.data[2] = b;
    fillData.data[3] = a;
    const w = this.canvas.nativeElement.width;
    const h = this.canvas.nativeElement.height;
    const startIndex = getIndex(startX, startY, w);
    const data = ctx.getImageData(0, 0, w, h);
    const newData = ctx.getImageData(0, 0, w, h);
    const bg = [
      data.data[startIndex + 0],
      data.data[startIndex + 1],
      data.data[startIndex + 2],
      data.data[startIndex + 3]
    ];

    if (bg[0] == r && bg[1] == g && bg[2] == b) {
      return
    }

    const stack = [{ x: startX, y: startY }];

    while (stack.length) {
      let { x, y } = stack.pop();

      if (!colorEq(data, bg, getIndex(x, y, w))) {
        continue;
      }

      while (x > 0 && colorEq(data, bg, getIndex(x - 1, y, w))) {
        x -= 1
      }

      let up = true, down = true;
      while (x < w && colorEq(data, bg, getIndex(x, y, w))) {
        const i = getIndex(x, y, w);
        data.data[i] = r;
        data.data[i + 1] = g;
        data.data[i + 2] = b;
        data.data[i + 3] = a;
        newData.data[i] = r;
        newData.data[i + 1] = g;
        newData.data[i + 2] = b;
        newData.data[i + 3] = a;

        if (y + 1 < h) {
          if (up && colorEq(data, bg, getIndex(x, y + 1, w))) {
            stack.push({ x, y: y + 1 });
          }
          up = !colorEq(data, bg, getIndex(x, y + 1, w));
        }

        if (y > 0) {
          if (down && colorEq(data, bg, getIndex(x, y - 1, w))) {
            stack.push({ x, y: y - 1 });
          }
          down = !colorEq(data, bg, getIndex(x, y - 1, w));
        }

        x += 1;
      }
    }
    ctx.putImageData(newData, 0, 0);
  }

  clearCanvas() {
    this.context.fillStyle = 'white';
    this.context.fillRect(0, 0, this.width, this.height);
  }

  isDrawContinuous(data) {
    if (!data) {
      return false;
    }
    const { x, y, prevX, prevY } = data;
    return !(typeof prevX !== 'number' || typeof prevY !== 'number' || (x === prevX && y === prevY));
  }

  calculateCanvasPosition(event: MouseEvent) {
    const rect = this.canvas.nativeElement.getBoundingClientRect();
    const prevX = this.prevX;
    const prevY = this.prevY;
    let x = Math.round(event.clientX - rect.left) - 2;
    let y = Math.round(event.clientY - rect.top);
    this.prevX = x;
    this.prevY = y;
    const thickness = this.thickness;
    if (x < -thickness || y < -thickness || x > this.width + thickness || y > this.height + thickness) {
      if (this.isOverCanvas) {
        if (x < -thickness) {
          x = -thickness;
        } else if (x > this.width + thickness) {
          x = this.width + thickness;
        }
        if (y < -thickness) {
          y = -thickness;
        } else if (y > this.height + thickness) {
          y = this.height + thickness;
        }
        this.isOverCanvas = false;
        return { x, y, prevX, prevY };
      }
      this.isOverCanvas = false;
      return null;
    }
    this.isOverCanvas = true;
    return { x, y, prevX, prevY };
  }

  onColorSelected(color: string) {
    this.color = color;
  }

  onThicknessSelected(thickness: number) {
    this.thickness = thickness;
  }

  onMouseDown(event: MouseEvent) {
    if (!this.canDraw) {
      return;
    }
    this.isMouseDown = true;
    const position = this.calculateCanvasPosition(event);
    if (!position) {
      this.startedClickOnCanvas = false;
      return
    }
    this.startedClickOnCanvas = true;
    const { x, y } = position;
    const message = new DrawMessage(
      this.tool,
      this.color,
      this.thickness,
      x,
      y,
      x,
      y
    );
    this.processDrawMessage(message.getPayload());
    this.communication.send(message);
  }

  onMouseUp(event: MouseEvent) {
    this.prevX = null;
    this.prevY = null;
    this.isMouseDown = false;
  }

  onMouseMove(event: MouseEvent) {
    if (this.startedClickOnCanvas) {
      event.preventDefault();
    } else {
      return;
    }
    const position = this.calculateCanvasPosition(event);
    if (!position) {
      return;
    }
    const { x, y, prevX, prevY } = position;
    if (event.buttons) {
      if (!this.canDraw) {
        return;
      }
      const message = new DrawMessage(
        this.tool,
        this.color,
        this.thickness,
        x,
        y,
        prevX,
        prevY
      );
      this.processDrawMessage(message.getPayload());
      this.communication.send(message);
    }
  }

  onWordChoice(wordChoice: string) {
    this.communication.send(new WordMessage(wordChoice));
  }

  resetDrawing() {
    if (!this.canDraw) {
      return;
    }
    const message = new DrawMessage('clear');
    this.processDrawMessage(message.getPayload());
    this.communication.send(message);
  }

  shareImage() {
    const now: any = new Date();
    if (this.lastShared && now - this.lastShared < 30 * 1000) {
      this.chat.addSystemError(`Wait ${30 - Math.round((now - this.lastShared) / 1000)} seconds before sharing again!`);
      return;
    }
    this.lastShared = now;
    this.discord.shareImage(this.context.canvas)
      .subscribe(
        () => this.chat.addSystemMessage('Image shared on discord!', 'green'),
        err => {
          console.error(err);
          this.chat.addSystemError(`Sharing failed: ${err.error.message}`)
        }
      )
  }

  undo() {
    if (!this.canDraw) {
      return;
    }
    const message = new DrawMessage('undo');
    this.processDrawMessage(message.getPayload());
    this.communication.send(message);
  }

  processDrawMessage(data, addToHistory = true) {
    this.context.strokeStyle = data.color;
    let { tool, x, y, prevX, prevY, thickness } = data;
    this.context.lineWidth = thickness;
    const isContinuous = this.isDrawContinuous(data);
    switch (tool) {
      case 'brush':
        this.context.beginPath();
        if (isContinuous) {
          this.context.lineCap = 'round';
          this.context.moveTo(prevX, prevY);
          this.context.lineTo(x, y);
        } else {
          this.context.ellipse(x - thickness, y, thickness, thickness, 0, 0, 0);
        }
        this.context.stroke();
        break;
      case 'bucket':
        this.bucketTool(x, y, data.color);
        break;
      case 'eraser':
        this.processDrawMessage({ ...data, color: 'white', tool: 'brush' }, false);
        break;
      case 'clear':
        this.drawHistory = [];
        this.clearCanvas();
        break;
      case 'undo':
        this.clearCanvas();
        let isLastContinuous;
        do {
          isLastContinuous = this.isDrawContinuous(this.drawHistory[this.drawHistory.length - 1]);
          this.drawHistory.pop();
        } while (isLastContinuous);
        this.drawHistory.forEach(data => this.processDrawMessage(data, false));
        addToHistory = false;
        break;
    }

    if (addToHistory) {
      this.drawHistory.push(data);
    }
  }

  processRoundResults(data) {
    const result = Object.keys(data).map(name => ({ name, score: data[name] }));
    result.sort((a, b) => b.score - a.score);
    return result;
  }
}
