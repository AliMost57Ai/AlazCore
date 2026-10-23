// components/PersianDateTimePicker/PersianDateTimePicker.tsx
'use client';

import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import {
  IconCalendar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconTrashX,
  IconX,
} from '@tabler/icons-react';
import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Grid,
  Group,
  Modal,
  Popover,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DateValue } from '@mantine/dates';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {
  addMonthsToPersian,
  formatPersianDate,
  generatePersianYears,
  getFullCalendar,
  getTodayPersian,
  isTodayPersian,
  PersianDate,
  persianMonths,
  shortWeekDays,
  toPersian,
  toWestern,
} from './DateTools';

export interface PersianDateTimePickerProps {
  value?: DateValue;
  valueFormat?: string;
  onChange: (date: DateValue | null) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  withSeconds?: boolean;
  dateFormat?: 'full' | 'short' | 'numeric';
  showOtherMonthDays?: boolean;
  clearable?: boolean;
  size?: 'md' | 'default' | 'half' | 'compact';
  /** 'auto' (پیش‌فرض): دسکتاپ popover، موبایل modal — قرارداد مالک 2026-10-05. */
  dropdownType?: 'auto' | 'popover' | 'normal' | 'modal';
  showTime?: boolean;
  defaultTime?: string;
  modalTitle?: string;
  /** متن راهنما زیر اینپوت — هم‌تراز description فیلدهای Mantine. */
  description?: string;
  /** اینپوت تمام‌عرض ظرف خودش شود — برای ردیف فیلتر و فرم‌های ستونی. */
  fullWidth?: boolean;
  /** برچسب مرئی حذف و aria-label بماند — برای ردیف فیلتر هم‌تراز بقیه فیلدها. */
  hideLabel?: boolean;
}

export function PersianDateTimePicker({
  value,
  valueFormat,
  onChange,
  label = 'تاریخ و زمان',
  placeholder = 'انتخاب تاریخ و زمان',
  error,
  required = false,
  disabled = false,
  dateFormat = 'full',
  showOtherMonthDays: _showOtherMonthDays = true,
  clearable = false,
  size = 'default',
  fullWidth: _fullWidth = false,
  hideLabel = false,
  dropdownType = 'auto',
  showTime = true,
  defaultTime = '00:00',
  withSeconds = false,
  modalTitle = 'انتخاب تاریخ و زمان',
  description,
}: PersianDateTimePickerProps) {
  const [selectedDate, setSelectedDate] = useState<DateValue | null>(value || null);
  const [time, setTime] = useState(
    value ? dayjs(value).format(withSeconds ? 'HH:mm:ss' : 'HH:mm') : defaultTime
  );
  const [popoverOpened, setPopoverOpened] = useState(false);
  // حالت 'auto' — قرارداد پروژه: دسکتاپ popover (dropdown)، موبایل modal.
  const isMobile = useMediaQuery('(max-width: 48em)', false, { getInitialValueInEffect: false });
  const resolvedDropdownType: 'popover' | 'normal' | 'modal' =
    dropdownType === 'auto' ? (isMobile ? 'modal' : 'popover') : dropdownType;
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [currentMonth, setCurrentMonth] = useState<PersianDate>(() => {
    const today = getTodayPersian();
    return { ...today, day: 1 };
  });
  const [selectedFormat, setSelectedFormat] = useState<'full' | 'short' | 'numeric'>(dateFormat);

  useEffect(() => {
    if (dateFormat) {
      setSelectedFormat(dateFormat);
    }
  }, [dateFormat]);

  useEffect(() => {
    if (value) {
      setSelectedDate(value);
      const persian = toPersian(new Date(value));
      setCurrentMonth({ year: persian.year, month: persian.month, day: 1 });
    }
  }, [value]);

  // محاسبه اندازه‌ها بر اساس prop size
  const sizes = useMemo(() => {
    const baseSizes = {
      md: {
        containerWidth: 340,
        dayButtonHeight: 28,
        fontSize: 12,
        inputFontSize: 15,
        iconSize: 14,
        buttonHeight: 28,
        gap: 'xs',
        inputSize: 'md' as const,
        buttonSize: 'sm' as const,
        selectHeight: 28,
        monthSelectWidth: 110,
        yearSelectWidth: 90,
        padding: 'xs',
      },
      default: {
        containerWidth: 320,
        dayButtonHeight: 24,
        fontSize: 11,
        iconSize: 12,
        buttonHeight: 24,
        gap: 'xs',
        inputSize: 'sm' as const,
        buttonSize: 'xs' as const,
        selectHeight: 24,
        monthSelectWidth: 100,
        yearSelectWidth: 80,
        padding: 'xs',
      },
      half: {
        containerWidth: 240,
        dayButtonHeight: 20,
        fontSize: 10,
        iconSize: 10,
        buttonHeight: 20,
        gap: 2,
        inputSize: 'xs' as const,
        buttonSize: 'xxs' as const,
        selectHeight: 20,
        monthSelectWidth: 80,
        yearSelectWidth: 70,
        padding: 'xs',
      },
      compact: {
        containerWidth: 200,
        dayButtonHeight: 18,
        fontSize: 9,
        iconSize: 9,
        buttonHeight: 18,
        gap: 1,
        inputSize: 'xs' as const,
        buttonSize: 'xxs' as const,
        selectHeight: 18,
        monthSelectWidth: 70,
        yearSelectWidth: 60,
        padding: 'xs',
      },
    };

    return baseSizes[size];
  }, [size]);

  const changeMonth = (direction: 'next' | 'prev') => {
    setCurrentMonth((prev) => {
      if (direction === 'next') {
        return addMonthsToPersian(prev, 1);
      } 
        return addMonthsToPersian(prev, -1);
      
    });
  };

  const handleMonthChange = (monthValue: string | null) => {
    if (!monthValue) {return;}
    setCurrentMonth((prev) => ({
      ...prev,
      month: parseInt(monthValue, 10),
    }));
  };

  const handleYearChange = (yearValue: string | null) => {
    if (!yearValue) {return;}
    setCurrentMonth((prev) => ({
      ...prev,
      year: parseInt(yearValue, 10),
    }));
  };

  const selectDay = (date: PersianDate, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) {
      setCurrentMonth({ ...date, day: 1 });
      return;
    }

    const newDate = toWestern(date);

    if (showTime && time) {
      const [hours, minutes, seconds] = time.split(':').map(Number);
      newDate.setHours(hours || 0, minutes || 0, seconds || 0);
    } else {
      newDate.setHours(0, 0, 0, 0);
    }

    setSelectedDate(dayjs(newDate).format(valueFormat));
    onChange(dayjs(newDate).format(valueFormat));

    if (resolvedDropdownType === 'popover') {
      setPopoverOpened(false);
    } else if (resolvedDropdownType === 'modal') {
      closeModal();
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTime(newTime);

    if (selectedDate && newTime) {
      const [hours, minutes, seconds] = newTime.split(':').map(Number);
      const newDate = new Date(selectedDate);
      newDate.setHours(hours || 0, minutes || 0, seconds || 0);

      setSelectedDate(dayjs(newDate).format(valueFormat));
      onChange(dayjs(newDate).format(valueFormat));
    }
  };

  const selectToday = () => {
    const todayPersian = getTodayPersian();
    setCurrentMonth({ ...todayPersian, day: 1 });

    const todayDate = toWestern(todayPersian);

    if (showTime && time) {
      const [hours, minutes, seconds] = time.split(':').map(Number);
      todayDate.setHours(hours || 0, minutes || 0, seconds || 0);
    } else {
      todayDate.setHours(0, 0, 0, 0);
    }

    setSelectedDate(dayjs(todayDate).format(valueFormat));
    onChange(dayjs(todayDate).format(valueFormat));
  };

  const clearSelection = () => {
    setSelectedDate(null);
    setTime(defaultTime ?? '00:00');
    onChange(null);
  };

  const handleOpen = () => {
    if (resolvedDropdownType === 'popover') {
      setPopoverOpened(true);
    } else if (resolvedDropdownType === 'modal') {
      openModal();
    }
  };

  const handleClose = () => {
    if (resolvedDropdownType === 'popover') {
      setPopoverOpened(false);
    } else if (resolvedDropdownType === 'modal') {
      closeModal();
    }
  };

  const renderCalendarDays = () => {
    const calendarData = getFullCalendar(currentMonth);
    const weeks: (typeof calendarData)[] = [];

    for (let i = 0; i < calendarData.length; i += 7) {
      weeks.push(calendarData.slice(i, i + 7));
    }

    return weeks.map((week, weekIndex) => (
      <React.Fragment key={weekIndex}>
        {week.map((dayData, dayIndex) => {
          const { date, isCurrentMonth } = dayData;

          const isSelected =
            selectedDate &&
            isCurrentMonth &&
            (() => {
              const selectedPersian = toPersian(new Date(selectedDate));

              return (
                selectedPersian.year === date.year &&
                selectedPersian.month === date.month &&
                selectedPersian.day === date.day
              );
            })();

          const isTodayDay = isCurrentMonth && isTodayPersian(date);
          const isFridayDay = dayIndex === 6;

          let buttonColor: string;
          if (isFridayDay) {
            buttonColor = 'red';
          } else if (isSelected) {
            buttonColor = 'blue';
          } else if (isCurrentMonth) {
            buttonColor = 'gray';
          } else {
            buttonColor = 'gray';
          }

          return (
            <Grid.Col span={1} key={`${weekIndex}-${dayIndex}`}>
              <Button
                fullWidth
                variant={isSelected ? 'filled' : 'light'}
                color={buttonColor as any}
                size="xs"
                radius="sm"
                onClick={() => selectDay(date, isCurrentMonth)}
                data-today={isTodayDay || undefined}
                aria-label={`${date.day} ${persianMonths[date.month - 1]} ${date.year}`}
                styles={{
                  root: {
                    height: sizes.dayButtonHeight,
                    minHeight: sizes.dayButtonHeight,
                    padding: '0 2px',
                    fontSize: `${sizes.fontSize}px`,
                    position: 'relative',
                    border: isTodayDay ? '1px solid #228be6' : 'none',
                    fontWeight: isTodayDay ? 'bold' : 'normal',
                    opacity: isCurrentMonth ? 1 : 0.5,
                    backgroundColor: isCurrentMonth
                      ? isSelected
                        ? undefined
                        : 'transparent'
                      : 'rgba(0, 0, 0, 0.03)',
                    color: isCurrentMonth ? undefined : 'gray',
                  },
                }}
                disabled={disabled}
              >
                {date.day}
                {isTodayDay && !isSelected && isCurrentMonth && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 1,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      backgroundColor: '#228be6',
                    }}
                  />
                )}
              </Button>
            </Grid.Col>
          );
        })}
      </React.Fragment>
    ));
  };

  const getDisplayValue = () => {
    if (!selectedDate) {return '';}

    const datePart = formatPersianDate(new Date(selectedDate), selectedFormat);

    if (showTime) {
      return `${datePart} ${time}`;
    }

    return datePart;
  };

  const yearOptions = generatePersianYears(10, 1).map((year) => ({
    value: year.toString(),
    label: year.toString(),
  }));

  // محتوای پیکر
  const calendarContent = (
    <Stack gap={sizes.gap} style={{ width: '100%' }}>
      {/* کنترل‌های ماه و سال */}
      <Group justify="space-between" wrap="nowrap" gap={3}>
        <ActionIcon
          variant="subtle"
          onClick={() => changeMonth('prev')}
          disabled={disabled}
          size="xs"
        >
          <IconChevronRight size={sizes.iconSize} />
        </ActionIcon>

        <Group gap={3} wrap="nowrap" style={{ flex: 1, justifyContent: 'center' }}>
          {/* دراپ‌داون ماه/سال باید داخل پاپ‌اوری خود تقویم رندر شود؛ با
              withinPortal پیش‌فرض، mousedown روی گزینه‌ها کلیک بیرونِ تقویم
              حساب شده و کل تقویم بسته می‌شد. */}
          <Select
            value={currentMonth.month.toString()}
            onChange={handleMonthChange}
            data={persianMonths.map((month, index) => ({
              value: (index + 1).toString(),
              label: month,
            }))}
            size="xs"
            comboboxProps={{ withinPortal: false }}
            styles={{
              input: {
                fontSize: `${sizes.fontSize}px`,
                height: sizes.selectHeight,
                minHeight: sizes.selectHeight,
                textAlign: 'center',
              },
            }}
            style={{ width: sizes.monthSelectWidth }}
            disabled={disabled}
          />

          <Select
            value={currentMonth.year.toString()}
            onChange={handleYearChange}
            data={yearOptions}
            size="xs"
            comboboxProps={{ withinPortal: false }}
            styles={{
              input: {
                fontSize: `${sizes.fontSize}px`,
                height: sizes.selectHeight,
                minHeight: sizes.selectHeight,
                textAlign: 'center',
              },
            }}
            style={{ width: sizes.yearSelectWidth }}
            disabled={disabled}
            searchable
          />
        </Group>

        <ActionIcon
          px="0"
          variant="subtle"
          onClick={() => changeMonth('next')}
          disabled={disabled}
          size="xs"
        >
          <IconChevronLeft size={sizes.iconSize} />
        </ActionIcon>
      </Group>

      {/* روزهای هفته */}
      <Grid columns={7} gutter={2}>
        {shortWeekDays.map((day, index) => (
          <Grid.Col span={1} key={index}>
            <Text
              ta="center"
              size="xs"
              c={index === 6 ? 'red' : 'dimmed'}
              fw={600}
              style={{ fontSize: `${sizes.fontSize}px` }}
            >
              {day}
            </Text>
          </Grid.Col>
        ))}
      </Grid>

      {/* روزهای ماه */}
      <Grid columns={7} gutter={2}>
        {renderCalendarDays()}
      </Grid>

      {/* بخش زمان */}
      {showTime && (
        <>
          <Divider my={2} />

          <Group align="flex-end" gap={6} wrap="nowrap">
            <Box style={{ flex: 1 }}>
              <Text size="xs" mb={2} style={{ fontSize: `${sizes.fontSize}px` }}>
                زمان:
              </Text>
              <TextInput
                type="time"
                value={time}
                onChange={handleTimeChange}
                step={withSeconds ? 1 : 60}
                disabled={disabled}
                size="xs"
                styles={{
                  input: {
                    fontSize: `${sizes.fontSize}px`,
                    height: sizes.selectHeight,
                    minHeight: sizes.selectHeight,
                  },
                }}
              />
            </Box>

            <Button
              variant="light"
              size="xs"
              onClick={() => {
                const now = new Date();
                const newTime = dayjs(now).format(withSeconds ? 'HH:mm:ss' : 'HH:mm');
                setTime(newTime);

                if (selectedDate) {
                  const [hours, minutes, seconds] = newTime.split(':').map(Number);
                  const newDate = new Date(selectedDate);
                  newDate.setHours(hours || 0, minutes || 0, seconds || 0);
                  onChange(dayjs(newDate).format(valueFormat));
                }
              }}
              disabled={disabled}
              leftSection={<IconClock size={sizes.iconSize} />}
              styles={{
                root: {
                  height: sizes.buttonHeight,
                  minHeight: sizes.buttonHeight,
                  padding: '0 8px',
                  whiteSpace: 'nowrap',
                },
                section: {
                  marginRight: 4,
                },
              }}
            >
              الان
            </Button>
          </Group>
        </>
      )}

      {/* دکمه‌های عمل */}
      <Group justify="space-between" mt={4} gap={4} wrap="nowrap">
        <ActionIcon
          variant="light"
          color="red"
          size={sizes.buttonSize}
          onClick={clearSelection}
          disabled={disabled || !selectedDate}
          title="پاک کردن"
        >
          <IconTrashX size={sizes.iconSize} />
        </ActionIcon>

        <Group gap={4} wrap="nowrap">
          <Button
            variant="light"
            size="xs"
            onClick={selectToday}
            disabled={disabled}
            styles={{
              root: {
                height: sizes.buttonHeight,
                minHeight: sizes.buttonHeight,
                padding: '0 8px',
                fontSize: `${sizes.fontSize}px`,
              },
            }}
          >
            امروز
          </Button>

          {(resolvedDropdownType === 'popover' || resolvedDropdownType === 'modal') && (
            <Button
              size="xs"
              onClick={handleClose}
              disabled={disabled}
              leftSection={<IconCheck size={sizes.iconSize} />}
              styles={{
                root: {
                  height: sizes.buttonHeight,
                  minHeight: sizes.buttonHeight,
                  padding: '0 8px',
                  fontSize: `${sizes.fontSize}px`,
                },
                section: {
                  marginRight: 4,
                },
              }}
            >
              تایید
            </Button>
          )}
        </Group>
      </Group>
    </Stack>
  );

  // ورودی اصلی
  const inputElement = (
    <TextInput
      label={hideLabel ? undefined : label}
      aria-label={hideLabel ? label : undefined}
      description={description}
      dir="ltr"
      placeholder={placeholder}
      value={getDisplayValue()}
      onClick={handleOpen}
      readOnly={resolvedDropdownType === 'popover' || resolvedDropdownType === 'modal'}
      rightSectionWidth={64}
      rightSection={
        <>
          <>
            {clearable ? (
              <ActionIcon variant="subtle" onClick={clearSelection} disabled={disabled} size="sm">
                <IconX size={12} />
              </ActionIcon>
            ) : (
              <></>
            )}
          </>
          {resolvedDropdownType === 'popover' || resolvedDropdownType === 'modal' ? (
            <ActionIcon variant="subtle" onClick={handleOpen} disabled={disabled} size="sm">
              <IconCalendar size={12} />
            </ActionIcon>
          ) : (
            <></>
          )}
        </>
      }
      error={error}
      required={required}
      disabled={disabled}
      size={sizes.inputSize}
      styles={{
        input: {
          cursor:
            resolvedDropdownType === 'popover' || resolvedDropdownType === 'modal'
              ? 'pointer'
              : 'default',
          fontSize: `${sizes.fontSize}px`,
          padding: '12px',
        },
      }}
    />
  );

  return (
    <Box>
      {resolvedDropdownType === 'popover' ? (
        <Popover
          opened={popoverOpened}
          onChange={setPopoverOpened}
          position="bottom-start"
          withArrow
          disabled={disabled}
          closeOnClickOutside
          width={sizes.containerWidth}
        >
          <Popover.Target>{inputElement}</Popover.Target>

          <Popover.Dropdown p={sizes.padding} style={{ width: sizes.containerWidth }}>
            {calendarContent}
          </Popover.Dropdown>
        </Popover>
      ) : resolvedDropdownType === 'modal' ? (
        <>
          {inputElement}

          <Modal
            opened={modalOpened}
            onClose={closeModal}
            title={modalTitle}
            centered
            size="auto"
            styles={{
              header: {
                padding: `${sizes.padding}px ${sizes.padding}px 0`,
                marginBottom: sizes.gap === 'xs' ? 12 : 8,
              },
              body: {
                padding: sizes.padding,
              },
              content: {
                width: sizes.containerWidth + 32,
                maxWidth: '95vw',
              },
            }}
          >
            {calendarContent}
          </Modal>
        </>
      ) : (
        // حالت normal
        <Box>
          {inputElement}

          {/* نمایش تقویم در حالت normal */}
          <Box
            mt="md"
            p="sm"
            style={{
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              width: sizes.containerWidth,
            }}
          >
            {calendarContent}
          </Box>
        </Box>
      )}
    </Box>
  );
}
