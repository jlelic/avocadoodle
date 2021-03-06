class Message {

  constructor(token) {
    this.token = token;
  }

  static get type(){
    return 'handshake';
  }

  getType() {
    return Message.type;
  }

  getPayload() {
    return {
      protocol: '0.1',
      token: this.token
    };
  }

}

module.exports = Message;
