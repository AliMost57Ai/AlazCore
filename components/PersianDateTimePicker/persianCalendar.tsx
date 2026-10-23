// components/PersianCalendar/PersianCalendar.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { ActionIcon, Box, Button, Grid, Group, Select, Text } from '@mantine/core';
import {
  addMonthsToPersian,
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

interface PersianCalendarProps {
  value?: Date;
  onChange?: (date: Date) => void;
  showYearSelect?: boolean;
  showMonthSelect?: boolean;
  showOtherMonthDays?: boolean;
}

export function PersianCalendar({
  value,
  onChange,
  showYearSelect = true,
  showMonthSelect = true,
  showOtherMonthDays = true,
}: PersianCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(value || new Date());
  const [currentMonth, setCurrentMonth] = useState<PersianDate>(() => {
    const persian = value ? toPersian(value) : getTodayPersian();
    return { ...persian, day: 1 };
  });

  useEffect(() => {
    if (value) {
      setSelectedDate(value);
      const persian = toPersian(value);
      setCurrentMonth({ ...persian, day: 1 });
    }
  }, [value]);

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

  const selectDay = (date: PersianDate) => {
    const newDate = toWestern(date);
    setSelectedDate(newDate);
    onChange?.(newDate);
  };

  const selectToday = () => {
    const todayPersian = getTodayPersian();
    setCurrentMonth({ ...todayPersian, day: 1 });
    const todayDate = toWestern(todayPersian);
    setSelectedDate(todayDate);
    onChange?.(todayDate);
  };

  const renderCalendarDays = () => {
    const calendarData = getFullCalendar(currentMonth);
    const weeks: (typeof calendarData)[] = [];

    // تقسیم به هفته‌های ۷ تایی
    for (let i = 0; i < calendarData.length; i += 7) {
      weeks.push(calendarData.slice(i, i + 7));
    }

    return weeks.map((week, weekIndex) => (
      <React.Fragment key={weekIndex}>
        {week.map((dayData, dayIndex) => {
          const { date, isCurrentMonth } = dayData;

          const selectedPersian = toPersian(selectedDate);
          const isSelected =
            isCurrentMonth &&
            selectedPersian.day === date.day &&
            selectedPersian.month === date.month &&
            selectedPersian.year === date.year;

          const isTodayDay = isCurrentMonth && isTodayPersian(date);
          const isFridayDay = dayIndex === 6; // ستون آخر = جمعه

          // اگر نمایش تاریخ‌های دیگر ماه‌ها غیرفعال باشد و تاریخ از ماه جاری نباشد، نمایش نده
          if (!showOtherMonthDays && !isCurrentMonth) {
            return <Grid.Col span={1} key={`${weekIndex}-${dayIndex}`} />;
          }

          return (
            <Grid.Col span={1} key={`${weekIndex}-${dayIndex}`}>
              <Button
                fullWidth
                variant={isSelected ? 'filled' : 'light'}
                color={isFridayDay ? 'red' : isSelected ? 'blue' : 'gray'}
                size="xs"
                radius="md"
                onClick={() => isCurrentMonth && selectDay(date)}
                style={{
                  height: 40,
                  border: isTodayDay ? '2px solid #228be6' : 'none',
                  fontWeight: isTodayDay ? 'bold' : 'normal',
                  opacity: isCurrentMonth ? 1 : 0.5,
                  backgroundColor: isCurrentMonth
                    ? isSelected
                      ? undefined
                      : 'transparent'
                    : 'rgba(0, 0, 0, 0.05)',
                }}
                disabled={!isCurrentMonth}
              >
                {date.day}
                {isTodayDay && !isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 6,
                      height: 6,
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

  const yearOptions = generatePersianYears(10, 10).map((year) => ({
    value: year.toString(),
    label: year.toString(),
  }));

  return (
    <Box style={{ width: 350 }}>
      <Group justify="space-between" mb="md">
        {showYearSelect || showMonthSelect ? (
          <Group gap="xs">
            {showMonthSelect && (
              <Select
                value={currentMonth.month.toString()}
                onChange={handleMonthChange}
                data={persianMonths.map((month, index) => ({
                  value: (index + 1).toString(),
                  label: month,
                }))}
                size="xs"
                style={{ width: 110 }}
              />
            )}

            {showYearSelect && (
              <Select
                value={currentMonth.year.toString()}
                onChange={handleYearChange}
                data={yearOptions}
                size="xs"
                style={{ width: 90 }}
                searchable
              />
            )}
          </Group>
        ) : (
          <Text fw={500}>
            {persianMonths[currentMonth.month - 1]} {currentMonth.year}
          </Text>
        )}

        <Group gap="xs">
          <ActionIcon variant="subtle" onClick={() => changeMonth('prev')}>
            <IconChevronRight size={18} />
          </ActionIcon>
          <Button size="xs" variant="light" onClick={selectToday}>
            امروز
          </Button>
          <ActionIcon variant="subtle" onClick={() => changeMonth('next')}>
            <IconChevronLeft size={18} />
          </ActionIcon>
        </Group>
      </Group>

      {/* روزهای هفته */}
      <Grid columns={7} gutter="xs" mb="xs">
        {shortWeekDays.map((day, index) => (
          <Grid.Col span={1} key={index}>
            <Text ta="center" size="sm" c={index === 6 ? 'red' : 'dimmed'} fw={700}>
              {day}
            </Text>
          </Grid.Col>
        ))}
      </Grid>

      {/* روزهای ماه */}
      <Grid columns={7} gutter="xs">
        {renderCalendarDays()}
      </Grid>

      {/* راهنمای رنگ‌ها */}
      {showOtherMonthDays && (
        <Group gap="xs" mt="md" justify="center">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                backgroundColor: 'transparent',
                border: '1px solid #dee2e6',
              }}
            />
            <Text size="xs" c="dimmed">
              ماه جاری
            </Text>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                opacity: 0.5,
              }}
            />
            <Text size="xs" c="dimmed">
              ماه‌های دیگر
            </Text>
          </div>
        </Group>
      )}
    </Box>
  );
}
