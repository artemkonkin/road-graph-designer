
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorComponent } from './components/editor/editor.component';
import { OffcanvasComponent } from './components/offcanvas/offcanvas.component';
import { GraphService } from './services/graph.service';
import { JsonViewerComponent } from './components/json-viewer/json-viewer.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, EditorComponent, OffcanvasComponent, JsonViewerComponent],
})
export class AppComponent {
  graphService = inject(GraphService);
}
