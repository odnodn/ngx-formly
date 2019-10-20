import { FormControl, FormGroup } from '@angular/forms';
import { Subject, of, BehaviorSubject } from 'rxjs';
import { FormlyFieldConfigCache } from '../../components/formly.field.config';
import { createBuilder } from '../../test-utils';

function buildField({ model, options, ...field }: FormlyFieldConfigCache): FormlyFieldConfigCache {
  const builder = createBuilder({
    extensions: ['core', 'validation', 'form', 'expression'],
  });

  builder.buildField({
    model: model || {},
    options,
    fieldGroup: [field],
  });

  return field;
}

describe('FieldExpressionExtension', () => {
  describe('field visibility (hideExpression)', () => {
    it('should evaluate string expression and update field visibility', () => {
      const field = buildField({
        key: 'text',
        hideExpression: '!model.visibilityToggle',
      });

      expect(field.hide).toBeTruthy();
      expect(field.templateOptions.hidden).toBeTruthy();

      field.model.visibilityToggle = 'test';
      field.options._checkField(field);

      expect(field.hide).toBeFalsy();
      expect(field.templateOptions.hidden).toBeFalsy();
    });

    it('should evaluate function expression and update field visibility', () => {
      const field = buildField({
        key: 'text',
        hideExpression: () => true,
      });

      expect(field.hide).toBeTruthy();
    });

    it('should toggle field control when hide changed programmatically', () => {
      const { fieldGroup: fields, formControl: form, options } = buildField({
        fieldGroup: [
          { hide: false, key: 'foo'},
          { hide: true, fieldGroup: [{key: 'bar'}]},
        ],
      });

      expect(form.get('foo')).not.toBeNull();
      expect(form.get('bar')).toBeNull();

      fields[0].hide = true;
      fields[1].hide = false;
      options._checkField({ formControl: form, fieldGroup: fields, options });

      expect(form.get('foo')).toBeNull();
      expect(form.get('bar')).not.toBeNull();
    });

    it('should not override hide field within fieldGroup', () => {
      const field = buildField({
        hideExpression: () => false,
        fieldGroup: [
          {
            key: 'test',
            hide: true,
          },
        ],
      });

      expect(field.hide).toBeFalsy();
      expect(field.fieldGroup[0].hide).toBeTruthy();
    });

    it('toggle controls of the hidden fields before the visible ones', () => {
      const field = buildField({
        model: { type: false },
        fieldGroup: [
          {
            key: 'key1',
            hideExpression: model => model.type,
          },
          {
            key: 'key1',
            hideExpression: model => !model.type,
          },
        ],
      });
      const { options, fieldGroup: fields, formControl: form } = field;

      options._checkField(field);
      expect(fields[0].hide).toBeFalsy();
      expect(fields[0].formControl).toBe(form.get('key1'));
      expect(fields[1].hide).toBeTruthy();
      expect(fields[1].formControl).toBe(form.get('key1'));
    });

    it('should take account of parent hide state', () => {
      const field = buildField({
        fieldGroup: [
          {
            key: 'parent',
            type: 'input',
            hide: true,
            fieldGroup: [
              {
                key: 'child',
                type: 'input',
                hideExpression: () => false,
                defaultValue: 'foo',
              },
            ],
          },
        ],
      });

      expect(field.fieldGroup[0].hide).toBeTruthy();
    });

    it('should support multiple field with the same key', () => {
      const field = buildField({
        fieldGroup: [
          {
            key: 'key1',
            formControl: new FormControl(),
            hideExpression: model => model.type,
          },
          {
            key: 'key1',
            formControl: new FormControl(),
            hideExpression: model => !model.type,
          },
        ],
      });

      const { formControl: form, fieldGroup: [f1, f2]} = field;

      field.model.type = false;
      field.options._checkField(field.parent);

      expect(f1.hide).toBeFalsy();
      expect(f1.formControl).toBe(form.get('key1'));
      expect(f2.hide).toBeTruthy();
      expect(f2.formControl).not.toBe(form.get('key1'));

      field.model.type = true;
      field.options._checkField(field.parent);
      expect(f1.hide).toBeTruthy();
      expect(f1.formControl).not.toBe(form.get('key1'));
      expect(f2.hide).toBeFalsy();
      expect(f2.formControl).toBe(form.get('key1'));
    });
  });

  describe('expressionProperties', () => {
    it('should resolve a string expression', () => {
      const field = buildField({
        key: 'name',
        model: { label: 'test' },
        options: { formState: { className: 'name_test' } },
        expressionProperties: {
          className: 'formState.className',
          'templateOptions.key': 'field.key',
          'templateOptions.label': 'model.label',
        },
      });

      expect(field.className).toEqual('name_test');
      expect(field.templateOptions.key).toEqual('name');
      expect(field.templateOptions.label).toEqual('test');
    });

    it('should resolve a function expression', () => {
      const field = buildField({
        model: { label: 'test' },
        expressionProperties: {
          'templateOptions.label': () => 'test',
        },
      });

      expect(field.templateOptions.label).toEqual('test');
    });

    it('should resolve an observable expression', () => {
      const field = buildField({
        expressionProperties: {
          'templateOptions.label': of('test'),
        },
      });

      expect(field.templateOptions.label).toEqual('test');
    });

    it('should resolve a model expression', () => {
      const field = buildField({
        model: { label: 'test' },
        options: { formState: { className: 'name_test' } },
        key: 'name',
        expressionProperties: {
          'model.name': () => 'name_test',
          'model.custom': () => 'custom_test',
        },
      });

      expect(field.formControl.value).toEqual('name_test');
      expect(field.model.name).toEqual('name_test');
      expect(field.model.custom).toEqual('custom_test');
    });

    it('should update field validity when using built-in validations expression', () => {
      const formControl = new FormControl();
      spyOn(formControl, 'updateValueAndValidity');

      buildField({
        key: 'checked',
        formControl,
        expressionProperties: {
          'templateOptions.required': 'model.checked',
        },
        model: { checked: true },
      });

      expect(formControl.updateValueAndValidity).toHaveBeenCalledTimes(3);
    });

    describe('field disabled state', () => {
      it('should update field disabled state', () => {
        const field = buildField({
          key: 'text',
          expressionProperties: {
            'templateOptions.disabled': 'model.disableToggle',
          },
        });

        expect(field.templateOptions.disabled).toBeFalsy();

        field.model.disableToggle = 'test';
        field.options._checkField(field);

        expect(field.templateOptions.disabled).toBeTruthy();
      });

      it('should take account of parent disabled state', () => {
        const disabled = {
          address: true,
          city: false,
        };
        const field = buildField({
          key: 'address',
          expressionProperties: { 'templateOptions.disabled': () => disabled.address },
          fieldGroup: [
            {
              key: 'city',
              expressionProperties: { 'templateOptions.disabled': () => disabled.city },
            },
            {
              key: 'street',
              expressionProperties: { 'templateOptions.label': () => 'Street' },
            },
          ],
        });

        expect(field.templateOptions.disabled).toBeTruthy();
        expect(field.fieldGroup[0].templateOptions.disabled).toBeTruthy();
        expect(field.fieldGroup[1].templateOptions.label).toEqual('Street');

        disabled.address = false;
        field.options._checkField(field);

        expect(field.templateOptions.disabled).toBeFalsy();
        expect(field.fieldGroup[0].templateOptions.disabled).toBeFalsy();

        disabled.city = true;

        field.options._checkField(field);

        expect(field.templateOptions.disabled).toBeFalsy();
        expect(field.fieldGroup[0].templateOptions.disabled).toBeTruthy();
      });

      it('should update disabled state of hidden fields', () => {
        const field = buildField({
          key: 'group',
          model: { group: { disableToggle: false } },
          expressionProperties: {
            'templateOptions.disabled': 'model.disableToggle',
          },
          fieldGroup: [
            { key: 'child', hide: true },
          ],
        });

        expect(field.templateOptions.disabled).toEqual(false);
        expect(field.fieldGroup[0].templateOptions.disabled).toEqual(false);

        field.model.disableToggle = true;
        field.options._checkField(field.parent);

        expect(field.templateOptions.disabled).toEqual(true);
        expect(field.fieldGroup[0].templateOptions.disabled).toEqual(true);
      });

      it('should update field on re-render', () => {
        const stream$ = new BehaviorSubject('test');
        const field = buildField({
          key: 'text',
          expressionProperties: {
            'templateOptions.label': stream$,
          },
        });
        expect(field.templateOptions.label).toEqual('test');

        field.hooks.onDestroy();
        stream$.next('test2');
        expect(field.templateOptions.label).toEqual('test');

        field.hooks.onInit();
        expect(field.templateOptions.label).toEqual('test2');
      });

      it('should change model through observable', () => {
        const field = buildField({
          key: 'text',
          expressionProperties: {
            'model.text': of('test'),
          },
        });

        expect(field.formControl.value).toEqual('test');
      });

      it('should supports array notation in expression property', () => {
        const field = buildField({
          expressionProperties: { 'model[0]': '"ddd"' },
        });

        expect(field.model).toEqual(['ddd']);
      });

      it('should throw error when assign to an undefined prop', () => {
        const build = () => buildField({
          key: 'text',
          expressionProperties: {
            'nested.prop': '"ddd"',
          },
        });

        expect(build).toThrowError(/\[Formly Error\] \[Expression "nested.prop"\] Cannot set property 'prop' of undefined/i);
      });
    });
  });

  describe('fieldChanges', () => {
    it('should emit fieldChanges on change field visibility', () => {
      const fieldChanges = new Subject<any>();
      const spy = jasmine.createSpy('fieldChanges spy');
      const subscription = fieldChanges.subscribe(spy);

      const field = buildField({
        key: 'text',
        hideExpression: '!model.visibilityToggle',
        options: { fieldChanges },
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ field, type: 'hidden', value: true });

      spy.calls.reset();
      field.model.visibilityToggle = 'test';
      field.options._checkField(field.parent);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ field, type: 'hidden', value: false });

      subscription.unsubscribe();
    });

    it('should emit fieldChanges when expression value changes', () => {
      const fieldChanges = new Subject<any>();
      const spy = jasmine.createSpy('fieldChanges spy');
      const subscription = fieldChanges.subscribe(spy);

      const field = buildField({
        key: 'text',
        options: { fieldChanges },
        expressionProperties: {
          'templateOptions.label': 'field.formControl.value',
        },
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        {
          field,
          type: 'expressionChanges',
          property: 'templateOptions.label',
          value: null,
        },
      );

      spy.calls.reset();
      field.formControl.patchValue('foo');
      field.options._checkField(field.parent);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        {
          field,
          type: 'expressionChanges',
          property: 'templateOptions.label',
          value: 'foo',
        },
      );

      subscription.unsubscribe();
    });
  });
});
