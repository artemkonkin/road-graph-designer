
import { Component, ChangeDetectionStrategy, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GraphService } from '../../services/graph.service';

@Component({
  selector: 'app-json-viewer',
  templateUrl: './json-viewer.component.html',
  styleUrls: ['./json-viewer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class JsonViewerComponent {
  graphService = inject(GraphService);
  copyButtonText = signal('Copy JSON');

  graphDataJson = computed(() => {
    const graphData = {
      intersections: this.graphService.intersections(),
      roads: this.graphService.roads(),
      trafficLightGroups: this.graphService.trafficLightGroups(),
    };
    return JSON.stringify(graphData, null, 2);
  });

  copyJsonToClipboard() {
    navigator.clipboard.writeText(this.graphDataJson()).then(() => {
      this.copyButtonText.set('Copied!');
      setTimeout(() => this.copyButtonText.set('Copy JSON'), 2000);
    }).catch(err => {
      console.error('Failed to copy JSON to clipboard', err);
      this.copyButtonText.set('Error!');
      setTimeout(() => this.copyButtonText.set('Copy JSON'), 2000);
    });
  }
}
