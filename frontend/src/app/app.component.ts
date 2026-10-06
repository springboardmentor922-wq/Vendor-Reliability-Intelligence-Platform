import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss' // Make sure src/app/app.component.scss actually exists on disk!
})
export class AppComponent {
  title = 'frontend';
}