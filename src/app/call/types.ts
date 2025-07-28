export enum CallStatus {
  Initiated = "initiated",
  Ringing = "ringing",
  Active = "active",
  Ended = "ended",
  Rejected = "rejected",
  Missed = "missed",
}

export interface Call {
  id: string;
  callerId: string;
  calleeId: string;
  status: CallStatus;
  initiatedAt: Date;
  answeredAt?: Date;
  endedAt?: Date;
}

export interface CallResponse {
  call: Call;
  role: 'caller' | 'callee';
}