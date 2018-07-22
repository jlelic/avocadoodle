import { Injectable } from '@angular/core';

@Injectable()
export class SoundsService {


  audio;

  constructor() {
    this.audio = new Audio;
  }

  playOk() {
    this.playRandomSound(['ok']);
  }

  playLoss() {
    // this.playRandomSound(['zobrat-beta-key']);
  }

  playOneLeft() {
    // this.playRandomSound(['to-je-retardacia']);
  }

  playChooseWord() {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance('Choose a word!'));
  }

  private playRandomSound(soundNames:string[]) {
    this.audio.src = `assets/sounds/${soundNames[Math.floor(Math.random()*soundNames.length)]}.wav`;
    this.audio.play();
  }
}
