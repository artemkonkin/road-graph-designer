import { Component, ChangeDetectionStrategy, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GraphService } from '../../services/graph.service';
import { GraphObject, Intersection, Road, TrafficLightState } from '../../models';

@Component({
  selector: 'app-offcanvas',
  templateUrl: './offcanvas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
})
export class OffcanvasComponent {
  graphService = inject(GraphService);

  selectedObject = this.graphService.selectedObject;

  // Use local signals for editing to prevent issues with two-way binding on service signals
  editableIntersection = signal<Intersection | null>(null);
  editableRoad = signal<Road | null>(null);

  constructor() {
    effect(() => {
      const obj = this.selectedObject();
      if (this.isIntersection(obj)) {
        this.editableIntersection.set({ ...obj });
        this.editableRoad.set(null);
      } else if (this.isRoad(obj)) {
        this.editableRoad.set({ ...obj });
        this.editableIntersection.set(null);
      } else {
        this.editableIntersection.set(null);
        this.editableRoad.set(null);
      }
    });
  }
  
  trafficLightGroupsForSelectedIntersection = computed(() => {
    const obj = this.editableIntersection();
    if (obj) {
      return this.graphService.getTrafficLightGroupsForIntersection(obj.id)
        .map(group => {
          const road = this.graphService.getRoadById(group.roadId);
          const otherEndId = road?.from === obj.id ? road.to : road?.from;
          const otherEnd = this.graphService.getIntersectionById(otherEndId ?? '');
          return {
            ...group,
            roadName: `Road to int_${otherEnd?.id.split('_')[1] ?? '...'}`,
          };
        });
    }
    return [];
  });

  totalForwardCongestion = computed(() => {
    return this.editableRoad()?.forwardLanes.reduce((sum, current) => sum + current, 0).toFixed(2);
  });
  
  totalBackwardCongestion = computed(() => {
    return this.editableRoad()?.backwardLanes.reduce((sum, current) => sum + current, 0).toFixed(2);
  });

  isIntersection(obj: GraphObject | null): obj is Intersection {
    return obj !== null && 'x' in obj && 'y' in obj;
  }

  isRoad(obj: GraphObject | null): obj is Road {
    return obj !== null && 'from' in obj && 'to' in obj;
  }

  saveIntersectionChanges() {
    const intersection = this.editableIntersection();
    if (intersection) {
      this.graphService.updateIntersection(intersection);
    }
  }

  updateIntersectionPosition(axis: 'x' | 'y', value: number) {
    this.editableIntersection.update(intersection => {
      if (!intersection) return null;
      return { ...intersection, [axis]: value };
    });
  }

  saveRoadChanges() {
    const road = this.editableRoad();
    if (road) {
      this.graphService.updateRoad(road);
    }
  }

  updateLaneCongestion(direction: 'forward' | 'backward', index: number, event: Event) {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.editableRoad.update(road => {
      if (!road) return null;
      if (direction === 'forward') {
        road.forwardLanes[index] = value;
      } else {
        road.backwardLanes[index] = value;
      }
      return { ...road };
    });
    this.saveRoadChanges();
  }

  addLane(direction: 'forward' | 'backward') {
    this.editableRoad.update(road => {
      if (!road) return null;
      if (direction === 'forward') {
        road.forwardLanes.push(0);
      } else {
        road.backwardLanes.push(0);
      }
      return { ...road };
    });
    this.saveRoadChanges();
  }

  removeLane(direction: 'forward' | 'backward') {
     this.editableRoad.update(road => {
      if (!road) return null;
      if (direction === 'forward' && road.forwardLanes.length > 0) {
        road.forwardLanes.pop();
      } else if (direction === 'backward' && road.backwardLanes.length > 0) {
        road.backwardLanes.pop();
      }
      return { ...road };
    });
    this.saveRoadChanges();
  }

  updateTrafficLightState(groupId: string, event: Event) {
    const select = event.target as HTMLSelectElement;
    this.graphService.updateTrafficLightState(groupId, select.value as TrafficLightState);
  }

  closePanel() {
    this.graphService.deselectObject();
  }
}