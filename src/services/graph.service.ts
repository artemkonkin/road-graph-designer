
import { Injectable, signal, effect } from '@angular/core';
import { Intersection, Road, GraphObject, TrafficLightGroup, TrafficLightState } from '../models';

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
        this.roads.set(JSON.parse(roadsData));
      }
      const trafficLightsData = localStorage.getItem(STORAGE_KEY_TRAFFIC_LIGHT_GROUPS);
      if (trafficLightsData) {
        this.trafficLightGroups.set(JSON.parse(trafficLightsData));
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
      id: `int_${Date.now()}`,
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

    const newRoad: Road = {
      id: `road_${Date.now()}`,
      from: fromId,
      to: toId,
      forwardLanes: [0],
      backwardLanes: [0],
    };
    this.roads.update(roads => [...roads, newRoad]);

    // Create traffic light groups for each end of the road
    const groupForTo: TrafficLightGroup = {
      id: `tlg_${newRoad.id}_${toId}`,
      roadId: newRoad.id,
      intersectionId: toId,
      state: 'red'
    };
     const groupForFrom: TrafficLightGroup = {
      id: `tlg_${newRoad.id}_${fromId}`,
      roadId: newRoad.id,
      intersectionId: fromId,
      state: 'red'
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
