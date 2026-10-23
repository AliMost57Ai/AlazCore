import { fireEvent, render, screen } from '@/test-utils';
import PhoneInput from './PhoneInput';

/** Renders the input and returns it with the change spy. */
function setup() {
  const onChange = jest.fn();
  render(<PhoneInput label="شماره موبایل" onChange={onChange} />);
  const input = screen.getByLabelText('شماره موبایل') as HTMLInputElement;
  return { input, onChange };
}

/** The value the form's onChange handler would read from the event. */
function reportedValue(onChange: jest.Mock): string {
  return onChange.mock.calls[0][0].target.value as string;
}

describe('PhoneInput', () => {
  it('passes a well-formed number through unchanged', () => {
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: '09121234567' } });
    expect(reportedValue(onChange)).toBe('09121234567');
    expect(input.value).toBe('09121234567');
  });

  it('adds the missing leading 0 when the number starts with 9', () => {
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: '9121234567' } });
    expect(reportedValue(onChange)).toBe('09121234567');
    expect(input.value).toBe('09121234567');
  });

  it('caps the number at 11 digits', () => {
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: '091212345678' } });
    expect(reportedValue(onChange)).toBe('09121234567');
    expect(input.value).toBe('09121234567');
  });

  it('converts Persian digits to Latin', () => {
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: '۰۹۱۲۱۲۳۴۵۶۷' } });
    expect(reportedValue(onChange)).toBe('09121234567');
    expect(input.value).toBe('09121234567');
  });

  it('strips everything that is not a digit', () => {
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: '09-abc 12' } });
    expect(reportedValue(onChange)).toBe('0912');
    expect(input.value).toBe('0912');
  });
});
