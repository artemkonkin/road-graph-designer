
import { Component, ChangeDetectionStrategy, inject, signal, computed, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GraphService } from '../../services/graph.service';
import { Intersection, Road, GraphObject } from '../../models';

interface Point {
  x: number;
  y: number;
}

@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class EditorComponent {
  graphService = inject(GraphService);
  gridSize = 20;

  drawingRoad: WritableSignal<{ from: Intersection; to: Point } | null> = signal(null);

  // --- Zoom and Pan State ---
  scale = signal(1);
  translateX = signal(0);
  translateY = signal(0);
  isPanning = signal(false);
  private panStartPoint = { x: 0, y: 0 };
  
  transform = computed(() => `translate(${this.translateX()} ${this.translateY()}) scale(${this.scale()})`);
  
  private getCongestionColor(lanes: number[]): string {
    if (lanes.length === 0) return '#6b7280'; // gray-500
    const avgCongestion = lanes.reduce((a, b) => a + b, 0) / lanes.length;

    if (avgCongestion <= 0.01) return '#6b7280'; // gray-500 for non-congested roads

    // HSL is easier for this. Hue from green (120) to red (0).
    const hue = (1 - avgCongestion) * 120;
    return `hsl(${hue}, 100%, 50%)`;
  }

  roadsWithCoords = computed(() => {
    const laneWidth = 4;
    return this.graphService.roads().map(road => {
      const fromNode = this.graphService.getIntersectionById(road.from);
      const toNode = this.graphService.getIntersectionById(road.to);
      if (!fromNode || !toNode) return null;

      const isSelected = this.graphService.selectedObject()?.id === road.id;

      const forwardWidth = road.forwardLanes.length * laneWidth;
      const backwardWidth = road.backwardLanes.length * laneWidth;

      const dx = toNode.x - fromNode.x;
      const dy = toNode.y - fromNode.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) return null;

      const p_dx = -dy / len; // Perpendicular vector component x
      const p_dy = dx / len;  // Perpendicular vector component y
      
      const centerOffset = (forwardWidth - backwardWidth) / 2;
      
      const forwardCenterOffset = centerOffset - forwardWidth / 2;
      const backwardCenterOffset = centerOffset + backwardWidth / 2;
      
      return {
        ...road,
        forward: {
          width: forwardWidth,
          color: isSelected ? '#38bdf8' : this.getCongestionColor(road.forwardLanes),
          x1: fromNode.x + p_dx * forwardCenterOffset, y1: fromNode.y + p_dy * forwardCenterOffset,
          x2: toNode.x + p_dx * forwardCenterOffset, y2: toNode.y + p_dy * forwardCenterOffset,
        },
        backward: {
          width: backwardWidth,
          color: isSelected ? '#38bdf8' : this.getCongestionColor(road.backwardLanes),
          x1: fromNode.x + p_dx * backwardCenterOffset, y1: fromNode.y + p_dy * backwardCenterOffset,
          x2: toNode.x + p_dx * backwardCenterOffset, y2: toNode.y + p_dy * backwardCenterOffset,
        },
        center: {
          x1: fromNode.x + p_dx * centerOffset, y1: fromNode.y + p_dy * centerOffset,
          x2: toNode.x + p_dx * centerOffset, y2: toNode.y + p_dy * centerOffset,
        }
      };
    }).filter((r): r is NonNullable<typeof r> => r !== null);
  });

  trafficLightsWithCoords = computed(() => {
    return this.graphService.trafficLightGroups().map(group => {
        const road = this.graphService.getRoadById(group.roadId);
        const intersection = this.graphService.getIntersectionById(group.intersectionId);
        if (!road || !intersection) return null;

        const fromNode = this.graphService.getIntersectionById(road.from);
        const toNode = this.graphService.getIntersectionById(road.to);
        if (!fromNode || !toNode) return null;

        const approachingNode = (intersection.id === road.to) ? fromNode : toNode;
        const targetNode = intersection;
        
        const dx = targetNode.x - approachingNode.x;
        const dy = targetNode.y - approachingNode.y;
        const len = Math.sqrt(dx*dx + dy*dy);
        if (len < 1) return null;

        const u_dx = dx / len; const u_dy = dy / len;
        const p_dx = -u_dy; const p_dy = u_dx;
        
        const laneWidth = 4;
        const roadWidth = (road.forwardLanes.length + road.backwardLanes.length) * laneWidth;
        
        const distanceBeforeIntersection = 20;
        const pos_x = targetNode.x - u_dx * distanceBeforeIntersection;
        const pos_y = targetNode.y - u_dy * distanceBeforeIntersection;

        const distanceFromRoadCenter = roadWidth / 2 + 6;
        
        const final_x = pos_x + p_dx * distanceFromRoadCenter;
        const final_y = pos_y + p_dy * distanceFromRoadCenter;

        const rotation = Math.atan2(dy, dx) * 180 / Math.PI;

        return { ...group, x: final_x, y: final_y, rotation };
    }).filter((t): t is NonNullable<typeof t> => t !== null);
  });

  handleSvgClick(event: MouseEvent) {
    if (event.button !== 0) return;
    const target = event.target as SVGElement;
    if (target.tagName === 'svg' || target.tagName === 'rect') {
      const svg = target.closest('svg');
      if (svg) {
        const pt = svg.createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;
        const svgPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse());

        const worldX = (svgPoint.x - this.translateX()) / this.scale();
        const worldY = (svgPoint.y - this.translateY()) / this.scale();
        
        const snappedX = Math.round(worldX / this.gridSize) * this.gridSize;
        const snappedY = Math.round(worldY / this.gridSize) * this.gridSize;
        this.graphService.addIntersection(snappedX, snappedY);
      }
    }
  }

  handleMouseDown(event: MouseEvent) {
    if (event.button === 1) { // Middle mouse button
      event.preventDefault();
      this.isPanning.set(true);
      this.panStartPoint = { x: event.clientX, y: event.clientY };
      this.drawingRoad.set(null);
    }
  }

  handleMouseDownOnIntersection(event: MouseEvent, intersection: Intersection) {
    if (event.button !== 0) return;
    event.stopPropagation();
    this.drawingRoad.set({
      from: intersection,
      to: { x: intersection.x, y: intersection.y },
    });
  }

  handleMouseUpOnIntersection(event: MouseEvent, intersection: Intersection) {
    if (event.button !== 0) return;
    event.stopPropagation();
    const road = this.drawingRoad();
    if (road && road.from.id !== intersection.id) {
      this.graphService.addRoad(road.from.id, intersection.id);
    }
    this.drawingRoad.set(null);
  }

  handleMouseMove(event: MouseEvent) {
    if (this.isPanning()) {
      const dx = event.clientX - this.panStartPoint.x;
      const dy = event.clientY - this.panStartPoint.y;
      this.translateX.update(val => val + dx);
      this.translateY.update(val => val + dy);
      this.panStartPoint = { x: event.clientX, y: event.clientY };
      return;
    }

    if (this.drawingRoad()) {
      const svg = (event.target as SVGElement).closest('svg');
      if (svg) {
        const pt = svg.createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;
        const svgPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse());

        const worldX = (svgPoint.x - this.translateX()) / this.scale();
        const worldY = (svgPoint.y - this.translateY()) / this.scale();

        this.drawingRoad.update(val => ({ ...val!, to: { x: worldX, y: worldY } }));
      }
    }
  }

  handleMouseUp(event: MouseEvent) {
    if (event.button === 0) {
      this.drawingRoad.set(null);
    } else if (event.button === 1) {
      this.isPanning.set(false);
    }
  }

  handleMouseLeave() {
    this.drawingRoad.set(null);
    this.isPanning.set(false);
  }

  selectObject(event: MouseEvent, object: GraphObject) {
    event.stopPropagation();
    this.graphService.selectObject(object);
  }

  handleContextMenu(event: MouseEvent, object?: GraphObject) {
    event.preventDefault();
    event.stopPropagation();
    if (object) {
      if ('x' in object) { // It's an Intersection
        this.graphService.deleteIntersection(object.id);
      } else { // It's a Road
        this.graphService.deleteRoad(object.id);
      }
    }
  }

  handleWheel(event: WheelEvent) {
    event.preventDefault();
    const zoomIntensity = 0.1;
    const minScale = 0.1;
    const maxScale = 5;
    const direction = event.deltaY > 0 ? -1 : 1;
    const oldScale = this.scale();
    const newScale = Math.max(minScale, Math.min(maxScale, oldScale + direction * zoomIntensity * oldScale));
    if (newScale === oldScale) return;
    
    const svg = (event.target as SVGElement).closest('svg');
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const worldX = (mouseX - this.translateX()) / oldScale;
    const worldY = (mouseY - this.translateY()) / oldScale;

    const newTranslateX = mouseX - worldX * newScale;
    const newTranslateY = mouseY - worldY * newScale;

    this.scale.set(newScale);
    this.translateX.set(newTranslateX);
    this.translateY.set(newTranslateY);
  }
}
