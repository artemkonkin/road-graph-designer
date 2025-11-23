
export enum TrafficLightState {
  Red = 1,
  Yellow = 2,
  Green = 3
}

export interface TrafficLightGroup {
  id: string;
  intersectionId: string; // The intersection it controls entry into
  roadId: string;         // The road it belongs to
  state: TrafficLightState;
  durations: Record<number, number>;
}

export interface Intersection {
  id: string;
  x: number;
  y: number;
}

export interface Road {
  id: string;
  from: string;
  to: string;
  forwardLanes: number[];
  backwardLanes: number[];
  length: number;
}

export type GraphObject = Intersection | Road;