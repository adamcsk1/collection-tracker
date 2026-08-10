import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from './tooltip';

describe('Tooltip', () => {
  let fixture: ComponentFixture<Tooltip>;
  const originalResizeObserver = window.ResizeObserver;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Tooltip] });
    fixture = TestBed.createComponent(Tooltip);
    fixture.componentRef.setInput('text', 'Tooltip text');
    fixture.componentRef.setInput('tooltipId', 'test-tooltip');
    fixture.componentRef.setInput('left', 100);
  });

  afterEach(() => {
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: originalResizeObserver });
  });

  it('does not render when hidden', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('renders the supplied text and accessibility attributes when visible', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector('[role="tooltip"]') as HTMLElement;
    expect(tooltip.textContent).toContain('Tooltip text');
    expect(tooltip.id).toBe('test-tooltip');
    expect(tooltip.getAttribute('data-test-id')).toBe('tooltip');
    expect(tooltip.style.left).toBe('100px');
  });

  it('uses a custom test id', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('dataTestId', 'custom-tooltip');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="custom-tooltip"]')).not.toBeNull();
  });

  it('keeps the tooltip within its positioning container', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const tooltip = fixture.nativeElement.querySelector('[role="tooltip"]') as HTMLElement;
    Object.defineProperty(fixture.nativeElement, 'clientWidth', { configurable: true, value: 200 });
    Object.defineProperty(tooltip, 'offsetWidth', { configurable: true, value: 100 });

    fixture.componentRef.setInput('left', 10);
    fixture.detectChanges();
    fixture.detectChanges();

    expect(tooltip.style.left).toBe('50px');

    Object.defineProperty(tooltip, 'offsetWidth', { configurable: true, value: 160 });
    fixture.componentRef.setInput('text', 'Longer tooltip text');
    fixture.componentRef.setInput('left', 190);
    fixture.detectChanges();
    fixture.detectChanges();

    expect(tooltip.style.left).toBe('120px');
  });

  it('removes the tooltip when visibility changes', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('observes tooltip size and disconnects observer on destroy', () => {
    const disconnect = vi.fn();
    const observe = vi.fn();
    const ResizeObserverMock = vi.fn(function (this: ResizeObserver) {
      Object.assign(this, { disconnect, observe, unobserve: vi.fn() });
    });
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: ResizeObserverMock });
    const observedFixture = TestBed.createComponent(Tooltip);
    observedFixture.componentRef.setInput('text', 'Observed tooltip');
    observedFixture.componentRef.setInput('tooltipId', 'observed-tooltip');
    observedFixture.componentRef.setInput('left', 20);
    observedFixture.componentRef.setInput('visible', true);

    try {
      observedFixture.detectChanges();
    } finally {
      observedFixture.destroy();
    }

    expect(observe).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });
});
