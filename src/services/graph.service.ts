import { Injectable, signal, effect } from '@angular/core';
import { Intersection, Road, GraphObject, TrafficLightGroup, TrafficLightState } from '../models';
import { uuidv7 } from 'uuidv7';

const STORAGE_KEY_INTERSECTIONS = 'roadGraphIntersections';
const STORAGE_KEY_ROADS = 'roadGraphRoads';
const STORAGE_KEY_TRAFFIC_LIGHT_GROUPS = 'roadGraphTrafficLightGroups';

@Injectable({
  providedIn: 'root',
})
export class GraphService {
  intersections = signal<Intersection[]>([]);
  roads = signal<Road[]>([]);
  trafficLightGroups = signal<TrafficLightGroup[]>([]);
  selectedObject = signal<GraphObject | null>(null);

  constructor() {
    this.loadFromLocalStorage();

    effect(() => {
      this.saveToLocalStorage();
    });
  }

  private loadFromLocalStorage() {
    try {
      const intersectionsData = localStorage.getItem(STORAGE_KEY_INTERSECTIONS);
      if (intersectionsData) {
        this.intersections.set(JSON.parse(intersectionsData));
      }
      
      const roadsData = localStorage.getItem(STORAGE_KEY_ROADS);
      if (roadsData) {
        let roads: Road[] = JSON.parse(roadsData);
        // Migration: Set default length for existing roads if missing
        roads = roads.map(r => {
            if (typeof r.length !== 'number') {
                return { ...r, length: 250 };
            }
            return r;
        });
        this.roads.set(roads);
      }

      const trafficLightsData = localStorage.getItem(STORAGE_KEY_TRAFFIC_LIGHT_GROUPS);
      if (trafficLightsData) {
        let groups: any[] = JSON.parse(trafficLightsData);
        
        // Migration: Convert strings to Enums and consolidate durations
        const migratedGroups: TrafficLightGroup[] = groups.map(g => {
            let state = g.state;
            // Migrate legacy string states to Enum numbers
            if (typeof state === 'string') {
                switch(state) {
                    case 'red': state = TrafficLightState.Red; break;
                    case 'yellow': state = TrafficLightState.Yellow; break;
                    case 'green': state = TrafficLightState.Green; break;
                    default: state = TrafficLightState.Red;
                }
            }
            
            // Sanitize legacy numeric states: 4 (RedYellow) -> Red, 5 (GreenBlinking) -> Green
            if (state === 4) state = TrafficLightState.Red;
            if (state === 5) state = TrafficLightState.Green;

            // Migrate flat duration fields to durations object
            let durations = g.durations;
            if (!durations) {
                durations = {
                    [TrafficLightState.Red]: g.redDuration ?? 60,
                    [TrafficLightState.Yellow]: g.yellowDuration ?? 3,
                    [TrafficLightState.Green]: g.greenDuration ?? 45
                };
            }

            return {
                ...g,
                state: state,
                durations: durations
            };
        });
        this.trafficLightGroups.set(migratedGroups);
      }
    } catch (e) {
      console.error('Failed to load graph from local storage', e);
    }
  }

  private saveToLocalStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_INTERSECTIONS, JSON.stringify(this.intersections()));
      localStorage.setItem(STORAGE_KEY_ROADS, JSON.stringify(this.roads()));
      localStorage.setItem(STORAGE_KEY_TRAFFIC_LIGHT_GROUPS, JSON.stringify(this.trafficLightGroups()));
    } catch (e) {
      console.error('Failed to save graph to local storage', e);
    }
  }
  
  // --- Intersection Methods ---

  addIntersection(x: number, y: number) {
    const newIntersection: Intersection = {
      id: uuidv7(),
      x,
      y,
    };
    this.intersections.update(intersections => [...intersections, newIntersection]);
  }

  deleteIntersection(id: string) {
    this.intersections.update(intersections => intersections.filter(i => i.id !== id));
    
    const roadsToDelete = this.roads().filter(r => r.from === id || r.to === id);
    roadsToDelete.forEach(road => this.deleteRoad(road.id));
    
    this.trafficLightGroups.update(groups => groups.filter(g => g.intersectionId !== id));

    if (this.selectedObject()?.id === id) {
        this.deselectObject();
    }
  }

  updateIntersection(updatedIntersection: Intersection) {
    // 1. Update the intersection itself
    this.intersections.update(intersections =>
      intersections.map(i => (i.id === updatedIntersection.id ? updatedIntersection : i))
    );

    if (this.selectedObject()?.id === updatedIntersection.id) {
      this.selectedObject.set(updatedIntersection);
    }
  }

  // --- Road Methods ---

  addRoad(fromId: string, toId: string) {
    if (this.roads().some(r => (r.from === fromId && r.to === toId) || (r.from === toId && r.to === fromId))) {
      return; // Road already exists
    }

    const fromNodeObj = this.getIntersectionById(fromId);
    const toNodeObj = this.getIntersectionById(toId);

    if (!fromNodeObj || !toNodeObj) return;

    const newRoad: Road = {
      id: uuidv7(),
      from: fromId,
      to: toId,
      forwardLanes: [0],
      backwardLanes: [0],
      length: 250, // Default fixed length
    };
    this.roads.update(roads => [...roads, newRoad]);

    const defaultDurations = {
        [TrafficLightState.Red]: 60,
        [TrafficLightState.Yellow]: 3,
        [TrafficLightState.Green]: 45
    };

    // Create traffic light groups for each end of the road
    const groupForTo: TrafficLightGroup = {
      id: uuidv7(),
      roadId: newRoad.id,
      intersectionId: toId,
      state: TrafficLightState.Red,
      durations: { ...defaultDurations }
    };
     const groupForFrom: TrafficLightGroup = {
      id: uuidv7(),
      roadId: newRoad.id,
      intersectionId: fromId,
      state: TrafficLightState.Red,
      durations: { ...defaultDurations }
    };
    this.trafficLightGroups.update(groups => [...groups, groupForTo, groupForFrom]);
  }

  deleteRoad(id: string) {
    this.roads.update(roads => roads.filter(r => r.id !== id));
    this.trafficLightGroups.update(groups => groups.filter(g => g.roadId !== id));
    if (this.selectedObject()?.id === id) {
        this.deselectObject();
    }
  }
  
  updateRoad(updatedRoad: Road) {
    this.roads.update(roads =>
      roads.map(r => (r.id === updatedRoad.id ? updatedRoad : r))
    );
    if (this.selectedObject()?.id === updatedRoad.id) {
      this.selectedObject.set(updatedRoad);
    }
  }

  // --- Traffic Light Methods ---

  updateTrafficLightState(groupId: string, state: TrafficLightState) {
    this.trafficLightGroups.update(groups => 
      groups.map(g => g.id === groupId ? {...g, state} : g)
    );
  }

  updateTrafficLightDuration(groupId: string, state: TrafficLightState, duration: number) {
    this.trafficLightGroups.update(groups => 
        groups.map(g => {
            if (g.id === groupId) {
                return {
                    ...g,
                    durations: {
                        ...g.durations,
                        [state]: duration
                    }
                };
            }
            return g;
        })
    );
  }

  getTrafficLightGroupsForIntersection(intersectionId: string): TrafficLightGroup[] {
    return this.trafficLightGroups().filter(g => g.intersectionId === intersectionId);
  }

  // --- Selection & Helper Methods ---

  selectObject(object: GraphObject) {
    this.selectedObject.set(object);
  }

  deselectObject() {
    this.selectedObject.set(null);
  }

  getIntersectionById(id: string): Intersection | undefined {
    return this.intersections().find(i => i.id === id);
  }

  getRoadById(id: string): Road | undefined {
    return this.roads().find(r => r.id === id);
  }
}