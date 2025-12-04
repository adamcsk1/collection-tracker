import { ComponentRef, Type, ViewContainerRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PortalService } from './portal-service';

class DummyComponent {}

describe('PortalService', () => {
  let service: PortalService;
  let clearSpy: jest.Mock;
  let createComponent: jest.Mock;
  let setInput: jest.Mock;
  let viewContainerRef: ViewContainerRef;
  let componentRef: ComponentRef<unknown>;

  beforeEach(() => {
    clearSpy = jest.fn();
    setInput = jest.fn();
    componentRef = { setInput } as unknown as ComponentRef<unknown>;
    createComponent = jest.fn().mockReturnValue(componentRef);
    viewContainerRef = {
      createComponent: createComponent as unknown as ViewContainerRef['createComponent'],
      clear: clearSpy,
    } as unknown as ViewContainerRef;

    TestBed.configureTestingModule({
      providers: [PortalService],
    });

    service = TestBed.inject(PortalService);
    service.setViewContainerRef(viewContainerRef);
  });

  it('opens a component and assigns inputs', () => {
    service.open(DummyComponent as Type<unknown>, { foo: 'bar', count: 2 });

    expect(createComponent).toHaveBeenCalledWith(DummyComponent);
    expect(setInput).toHaveBeenCalledWith('foo', 'bar');
    expect(setInput).toHaveBeenCalledWith('count', 2);
    expect(service.componentRef()).toBe(componentRef);
  });

  it('clears the view container and resets the componentRef on close', () => {
    service.open(DummyComponent);
    service.close();

    expect(clearSpy).toHaveBeenCalled();
    expect(service.componentRef()).toBeNull();
  });
});
