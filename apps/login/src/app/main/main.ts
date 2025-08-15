import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  imports: [RouterModule],
  selector: 'lo-root',
  templateUrl: './main.html',
  styleUrl: './main.css',
})
export class Main {
  protected title = 'login';
}
