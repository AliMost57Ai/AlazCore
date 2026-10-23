import { DEFAULT_SMS_TEMPLATE, renderSmsTemplate, SAMPLE_SMS_VALUES } from './sms-template';

describe('renderSmsTemplate', () => {
  it('replaces every placeholder with its value', () => {
    const result = renderSmsTemplate(
      'سفارش {order} مبلغ {amount} پیگیری {refId} ارسال {delivery} تاریخ {date}',
      SAMPLE_SMS_VALUES
    );

    expect(result).toBe(
      `سفارش ${SAMPLE_SMS_VALUES.order} مبلغ ${SAMPLE_SMS_VALUES.amount} پیگیری ${SAMPLE_SMS_VALUES.refId} ارسال ${SAMPLE_SMS_VALUES.delivery} تاریخ ${SAMPLE_SMS_VALUES.date}`
    );
  });

  it('leaves unknown tokens untouched so typos stay visible', () => {
    expect(renderSmsTemplate('x {unknown} {order}', SAMPLE_SMS_VALUES)).toBe(
      `x {unknown} ${SAMPLE_SMS_VALUES.order}`
    );
  });

  it('renders the default template with no leftover tokens', () => {
    const result = renderSmsTemplate(DEFAULT_SMS_TEMPLATE, SAMPLE_SMS_VALUES);

    expect(result).not.toMatch(/\{(order|amount|refId|delivery|date)\}/);
    expect(result).toContain(SAMPLE_SMS_VALUES.order);
    expect(result).toContain(SAMPLE_SMS_VALUES.refId);
  });

  it('renders a pattern parameter value used as a mini-template', () => {
    expect(renderSmsTemplate('{order}/{amount}', SAMPLE_SMS_VALUES)).toBe(
      `${SAMPLE_SMS_VALUES.order}/${SAMPLE_SMS_VALUES.amount}`
    );
  });
});
