import type { PeerMessage } from "./protocol.js";

type EventMap = {
  paired: [opponent: string, playerIndex: 0 | 1];
  connected: [];
  message: [msg: PeerMessage];
  disconnected: [];
  error: [err: Error];
};

type EventKey = keyof EventMap;

export class ConnectionManager {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private listeners = new Map<string, Set<Function>>();

  private _playerIndex: 0 | 1 = 0;
  private _opponent = "";
  private _connected = false;

  constructor(private signalingUrl: string) {}

  get playerIndex() { return this._playerIndex; }
  get opponentAddress() { return this._opponent; }
  get connected() { return this._connected; }

  on<K extends EventKey>(event: K, cb: (...args: EventMap[K]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }

  off<K extends EventKey>(event: K, cb: (...args: EventMap[K]) => void) {
    this.listeners.get(event)?.delete(cb);
  }

  private emit<K extends EventKey>(event: K, ...args: EventMap[K]) {
    this.listeners.get(event)?.forEach((cb) => (cb as Function)(...args));
  }

  join(duelId: number, address: string): void {
    this.ws = new WebSocket(this.signalingUrl);

    this.ws.onopen = () => {
      this.ws!.send(JSON.stringify({ type: "join", duelId, address }));
    };

    this.ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      this.handleSignalingMessage(msg);
    };

    this.ws.onclose = () => {
      if (this._connected) {
        this._connected = false;
        this.emit("disconnected");
      }
    };

    this.ws.onerror = () => {
      this.emit("error", new Error("WebSocket error"));
    };
  }

  private handleSignalingMessage(msg: any) {
    switch (msg.type) {
      case "paired":
        this._playerIndex = msg.playerIndex;
        this._opponent = msg.opponent;
        this.emit("paired", msg.opponent, msg.playerIndex);
        if (msg.playerIndex === 0) {
          this.createOffer();
        }
        break;

      case "sdp-offer":
        this.handleOffer(msg.sdp);
        break;

      case "sdp-answer":
        this.pc?.setRemoteDescription(msg.sdp);
        break;

      case "ice-candidate":
        this.pc?.addIceCandidate(msg.candidate);
        break;

      case "opponent-disconnected":
        this._connected = false;
        this.emit("disconnected");
        break;
    }
  }

  private setupPeerConnection() {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    this.pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        this.ws?.send(JSON.stringify({ type: "ice-candidate", candidate: evt.candidate }));
      }
    };

    this.pc.ondatachannel = (evt) => {
      this.setupDataChannel(evt.channel);
    };
  }

  private setupDataChannel(dc: RTCDataChannel) {
    this.dc = dc;
    dc.onopen = () => {
      this._connected = true;
      this.emit("connected");
    };
    dc.onclose = () => {
      this._connected = false;
      this.emit("disconnected");
    };
    dc.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as PeerMessage;
        this.emit("message", msg);
      } catch { /* ignore malformed */ }
    };
  }

  private async createOffer() {
    this.setupPeerConnection();
    const dc = this.pc!.createDataChannel("game");
    this.setupDataChannel(dc);

    const offer = await this.pc!.createOffer();
    await this.pc!.setLocalDescription(offer);
    this.ws?.send(JSON.stringify({ type: "sdp-offer", sdp: offer }));
  }

  private async handleOffer(sdp: RTCSessionDescriptionInit) {
    this.setupPeerConnection();
    await this.pc!.setRemoteDescription(sdp);
    const answer = await this.pc!.createAnswer();
    await this.pc!.setLocalDescription(answer);
    this.ws?.send(JSON.stringify({ type: "sdp-answer", sdp: answer }));
  }

  send(msg: PeerMessage) {
    if (this.dc?.readyState === "open") {
      this.dc.send(JSON.stringify(msg));
    }
  }

  sendToServer(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect() {
    this.dc?.close();
    this.pc?.close();
    this.ws?.close();
    this._connected = false;
  }
}
