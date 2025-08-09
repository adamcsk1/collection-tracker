import { Component, input } from '@angular/core';
import { StatisticsItemModel } from '@statistics/statistics-model';

@Component({
  selector: 'ct-statistics-item',
  templateUrl: './statistics-item.html',
  styleUrl: './statistics-item.css',
})
export class StatisticsItem {
  public readonly item = input.required<StatisticsItemModel>();
}
