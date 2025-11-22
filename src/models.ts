
export type TrafficLightState = 'red' | 'red-yellow' | 'yellow' | 'green' | 'green-blinking';

export interface TrafficLightGroup {
  id: string;
  intersectionId: string; // The intersection it controls entry into
  roadId: string;         // The road it belongs to
  state: TrafficLightState;
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
}

export type GraphObject = Intersection | Road;
