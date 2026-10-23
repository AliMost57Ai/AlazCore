'use client';

import {
  Fragment,
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import {
  IconArrowsSort,
  IconChevronDown,
  IconChevronUp,
  IconHelpCircle,
  IconListDetails,
} from '@tabler/icons-react';
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import EmptyState from '@/components/layout/EmptyState';
import classes from './PanelList.module.css';

/**
 * قاعده واحد لیست‌های پنل — تک منبع رفتار جدول/کارت/آکاردئون/حالت خالی.
 *
 * دسکتاپ (sm+): جدول با سربرگ recessive روشن؛ اگر renderDetail داده شود ردیف
 * با کلیک باز می‌شود (آکاردئون زیر خود ردیف — دکمه فلشِ سر ردیف کنترل
 * کیبورد/صفحه‌خوان است و هیچ دکمه «بستن» جداگانه‌ای وجود ندارد).
 *
 * موبایل (<sm): کارت هر ردیف — نه جدولِ اسکرول‌افقی؛ جزئیات به‌جای آکاردئون با
 * لینک به صفحه اختصاصی باز می‌شود (detailHref). ستون عملیات هر دو جا
 * stopPropagation می‌گیرد تا آکاردئون را نبندد.
 *
 * مرتب‌سازی: ستون‌های دارای sortValue سربرگ کلیک‌خور دارند (چرخه صعودی →
 * نزولی → خاموش)؛ موبایل یک ردیف «ترتیب» بالای کارت‌ها می‌گیرد. ترتیب پیش‌فرض
 * همان ترتیب سرور است.
 */
export interface PanelColumn<T> {
  key: string;
  header: string;
  /** راهنمای ستون — آیکون سؤال کنار سربرگ با tooltip (منبع داده/فرمول). */
  headerHint?: string;
  w?: number | string;
  align?: 'start' | 'center' | 'end';
  /** مقدار مرتب‌سازی — بودنش ستون را قابل مرتب‌سازی می‌کند (سربرگ کلیک‌خور). */
  sortValue?: (row: T) => string | number;
  /** محتوای سلول دسکتاپ — به‌عنوان مقدار کارت موبایل هم مصرف می‌شود. */
  cell: (row: T) => ReactNode;
  /** رندر جایگزین فقط برای کارت موبایل (وقتی سلول دسکتاپ در کارت نمی‌نشیند). */
  card?: (row: T) => ReactNode;
  /** تیتر کارت موبایل (بالای کارت، بولد و truncate). */
  cardTitle?: boolean;
  /** روبه‌روی تیتر کارت (بج وضعیت / مبلغ). */
  cardHead?: boolean;
  /** از ردیف‌های کارت موبایل حذف شود. */
  desktopOnly?: boolean;
}

export interface PanelEmptyState {
  icon: ComponentType<{ size?: number; stroke?: number; style?: CSSProperties }>;
  message: string;
  hint?: string;
}

export interface PanelListProps<T> {
  rows: T[];
  columns: PanelColumn<T>[];
  getRowId: (row: T) => string;
  /** جزئیات آکاردئونی دسکتاپ — زیر ردیفِ همان ردیف باز می‌شود. */
  renderDetail?: (row: T) => ReactNode;
  /** ردیف‌های بدون جزئیات واقعی فلش و کلیک نمی‌گیرند (کنترل مرده ممنوع). */
  hasDetail?: (row: T) => boolean;
  /** سربرگ ردیف جزئیات — پیش‌فرض «جزئیات ردیف {id}». */
  detailHeading?: (row: T) => string;
  /** صفحه اختصاصی جزئیات برای موبایل (قاعده: نه مودال نه آکاردئون در موبایل).
   *  null = این ردیف صفحه جزئیات ندارد (لینک نمایش داده نمی‌شود). */
  detailHref?: (row: T) => string | null;
  detailLabel?: (row: T) => string;
  /** محتوای ثابتِ انتهای کارت موبایل (مثل بلوک پاسخ API) — بدون تعامل. */
  cardExtra?: (row: T) => ReactNode;
  /** فعال‌ساز ردیف بدون آکاردئون (مثلاً بازکردن گفتگو) — دسکتاپ: کلیک ردیف؛
   *  موبایل: دکمه انتهای کارت با برچسب activateLabel. */
  onRowActivate?: (row: T) => void;
  activateLabel?: (row: T) => string;
  /** ستون عملیات دسکتاپ — کلیک‌هایش آکاردئون را تریگر نمی‌کند. */
  renderActions?: (row: T) => ReactNode;
  /** جایگزین عملیات در کارت موبایل (مثلاً لینک صفحه به‌جای مودال) —
   *  نبودش یعنی همان renderActions در موبایل هم می‌آید. */
  renderMobileActions?: (row: T) => ReactNode;
  empty: PanelEmptyState;
}

/** فلش آکاردئون — چرخش ۱۸۰ درجه هنگام باز شدن. */
function Chevron({ open }: { open: boolean }) {
  return (
    <Box
      component="span"
      style={{
        display: 'inline-flex',
        transition: 'transform 150ms ease',
        transform: open ? 'rotate(180deg)' : 'none',
      }}
      aria-hidden
    >
      <IconChevronUp size={16} stroke={2} />
    </Box>
  );
}

export default function PanelList<T>({
  rows,
  columns,
  getRowId,
  renderDetail,
  hasDetail,
  detailHeading,
  detailHref,
  detailLabel,
  cardExtra,
  onRowActivate,
  activateLabel,
  renderActions,
  renderMobileActions,
  empty,
}: PanelListProps<T>) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // مرتب‌سازی — null یعنی ترتیب سرور؛ چرخه کلیک: صعودی → نزولی → خاموش.
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const sortableColumns = useMemo(() => columns.filter((column) => column.sortValue), [columns]);

  const sortedRows = useMemo(() => {
    const active = sort ? sortableColumns.find((column) => column.key === sort.key) : null;
    if (!active?.sortValue) {
      return rows;
    }
    const dir = sort!.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = active.sortValue!(a);
      const vb = active.sortValue!(b);
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'fa');
      return cmp * dir;
    });
  }, [rows, sort, sortableColumns]);

  function cycleSort(key: string) {
    setSort((current) => {
      if (!current || current.key !== key) {
        return { key, dir: 'asc' };
      }
      if (current.dir === 'asc') {
        return { key, dir: 'desc' };
      }
      return null;
    });
  }

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (rows.length === 0) {
    return <EmptyState icon={empty.icon} message={empty.message} hint={empty.hint} />;
  }

  const sortIcon = (column: PanelColumn<T>) => {
    if (!sort || sort.key !== column.key) {
      return <IconArrowsSort size={12} stroke={2} opacity={0.45} />;
    }
    return sort.dir === 'asc' ? (
      <IconChevronUp size={12} stroke={2.4} />
    ) : (
      <IconChevronDown size={12} stroke={2.4} />
    );
  };

  const colCount = columns.length + (renderActions ? 1 : 0);
  const alignStyle = (align?: 'start' | 'center' | 'end') =>
    align ? { textAlign: align } : undefined;

  return (
    <>
      {/* دسکتاپ: جدول واقعی؛ جزئیات به‌صورت ردیف تمام‌عرض زیر همان ردیف باز
          می‌شود — نه ردیفِ جدا در انتهای جدول. ScrollContainer فقط هنگام
          سرریز واقعی اسکرول می‌گیرد (موبایل اصلاً جدول نمی‌بیند). */}
      <Box visibleFrom="sm">
        <Table.ScrollContainer minWidth={0}>
          {/* horizontalSpacing sm — فاصله سلول‌ها یک پله جمع‌تر از پیش‌فرض تا
              جدول‌های عملیات‌دار در عرض معمول دسکتاپ بدون اسکرول جا شوند. */}
          <Table verticalSpacing="sm" horizontalSpacing="sm" className={classes.table}>
            <Table.Thead>
              <Table.Tr>
                {renderDetail ? <Table.Th w={44} /> : null}
                {columns.map((column) => (
                  <Table.Th key={column.key} w={column.w} style={alignStyle(column.align)}>
                    <Box
                      component="span"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      {column.sortValue ? (
                        <Box
                          component="button"
                          type="button"
                          onClick={() => cycleSort(column.key)}
                          aria-label={`مرتب‌سازی بر اساس ${column.header}${
                            sort?.key === column.key
                              ? sort.dir === 'asc'
                                ? ' (صعودی)'
                                : ' (نزولی)'
                              : ''
                          }`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            font: 'inherit',
                            color: 'inherit',
                            cursor: 'pointer',
                          }}
                        >
                          {column.header}
                          {sortIcon(column)}
                        </Box>
                      ) : (
                        column.header
                      )}
                      {column.headerHint ? (
                        <Tooltip
                          label={column.headerHint}
                          multiline
                          w={280}
                          withArrow
                          position="bottom-start"
                        >
                          <Box
                            component="span"
                            className={classes.headerHint}
                            aria-label={`${column.header}: ${column.headerHint}`}
                            tabIndex={0}
                          >
                            <IconHelpCircle size={14} stroke={2} />
                          </Box>
                        </Tooltip>
                      ) : null}
                    </Box>
                  </Table.Th>
                ))}
                {renderActions ? <Table.Th>عملیات</Table.Th> : null}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedRows.map((row) => {
                const id = getRowId(row);
                const open = expanded.has(id);
                const canExpand = Boolean(renderDetail && (!hasDetail || hasDetail(row)));
                const activatable = canExpand || Boolean(onRowActivate);
                return (
                  <Fragment key={id}>
                    <Table.Tr
                      onClick={
                        canExpand
                          ? () => toggle(id)
                          : onRowActivate
                            ? () => onRowActivate(row)
                            : undefined
                      }
                      className={activatable ? classes.row : undefined}
                    >
                      {renderDetail ? (
                        <Table.Td>
                          {canExpand ? (
                            <Box
                              component="button"
                              type="button"
                              className={classes.expand}
                              aria-expanded={open}
                              aria-label={
                                open ? `بستن جزئیات ردیف ${id}` : `نمایش جزئیات ردیف ${id}`
                              }
                              onClick={(event) => {
                                event.stopPropagation();
                                toggle(id);
                              }}
                            >
                              <Chevron open={open} />
                            </Box>
                          ) : null}
                        </Table.Td>
                      ) : null}
                      {columns.map((column) => (
                        <Table.Td key={column.key} style={alignStyle(column.align)}>
                          {column.cell(row)}
                        </Table.Td>
                      ))}
                      {renderActions ? (
                        <Table.Td onClick={(event) => event.stopPropagation()}>
                          {renderActions(row)}
                        </Table.Td>
                      ) : null}
                    </Table.Tr>
                    {renderDetail && canExpand && open ? (
                      <Table.Tr className={classes.detailRow}>
                        <Table.Td colSpan={colCount + 1}>
                          <Stack gap="sm">
                            <Group
                              justify="space-between"
                              wrap="nowrap"
                              gap="xs"
                              onClick={() => toggle(id)}
                              className={classes.detailHeader}
                            >
                              <Text size="xs" fw={700} c="dimmed">
                                {detailHeading ? detailHeading(row) : `جزئیات ردیف ${id}`}
                              </Text>
                              <Chevron open={open} />
                            </Group>
                            {renderDetail(row)}
                          </Stack>
                        </Table.Td>
                      </Table.Tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Box>

      {/* موبایل: نوار ترتیب بالای کارت‌ها وقتی ستونی قابل مرتب‌سازی است. */}
      {sortableColumns.length > 0 ? (
        <Group gap="xs" hiddenFrom="sm" mb="sm">
          <Text size="xs" c="dimmed">
            ترتیب:
          </Text>
          <Select
            size="xs"
            radius="md"
            w={160}
            placeholder="پیش‌فرض"
            clearable
            data={sortableColumns.map((column) => ({ value: column.key, label: column.header }))}
            value={sort?.key ?? null}
            onChange={(value) => setSort(value ? { key: value, dir: 'desc' } : null)}
            aria-label="ستون مرتب‌سازی"
          />
          {sort ? (
            <ActionIcon
              variant="default"
              size="sm"
              radius="md"
              onClick={() => setSort({ key: sort.key, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
              aria-label={sort.dir === 'asc' ? 'تغییر به نزولی' : 'تغییر به صعودی'}
            >
              {sort.dir === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
            </ActionIcon>
          ) : null}
        </Group>
      ) : null}

      {/* موبایل: یک کارت برای هر ردیف — همان ترتیب و همان داده جدول. */}
      <Stack gap="sm" hiddenFrom="sm" className={classes.mobileCards}>
        {sortedRows.map((row) => {
          const id = getRowId(row);
          const title = columns.find((column) => column.cardTitle);
          const head = columns.find((column) => column.cardHead);
          const fields = columns.filter(
            (column) => !column.desktopOnly && !column.cardTitle && !column.cardHead
          );
          return (
            <Card key={id} padding="sm" radius="md">
              {title || head ? (
                <Group justify="space-between" wrap="nowrap" gap="xs" mb={6}>
                  <Text size="sm" fw={600} truncate style={{ minWidth: 0 }}>
                    {title ? (title.card ?? title.cell)(row) : null}
                  </Text>
                  {head ? (head.card ?? head.cell)(row) : null}
                </Group>
              ) : null}

              <Stack gap={6}>
                {fields.map((column) => (
                  <div key={column.key} className={classes.cardField}>
                    <Text size="xs" className={classes.cardFieldLabel}>
                      {column.header}
                    </Text>
                    {(column.card ?? column.cell)(row)}
                  </div>
                ))}
              </Stack>

              {onRowActivate && !detailHref ? (
                <Button
                  variant="light"
                  color="gray"
                  size="xs"
                  fullWidth
                  leftSection={<IconListDetails size={14} />}
                  mt={10}
                  onClick={() => onRowActivate(row)}
                >
                  {activateLabel ? activateLabel(row) : 'مشاهده'}
                </Button>
              ) : null}

              {cardExtra ? cardExtra(row) : null}

              {detailHref && detailHref(row) ? (
                <Button
                  component={Link}
                  href={detailHref(row) as string}
                  variant="light"
                  color="gray"
                  size="xs"
                  fullWidth
                  leftSection={<IconListDetails size={14} />}
                  mt={10}
                >
                  {detailLabel ? detailLabel(row) : 'جزئیات'}
                </Button>
              ) : null}

              {renderActions || renderMobileActions ? (
                <Group justify="flex-end" gap="xs" mt="xs" wrap="wrap">
                  {renderMobileActions
                    ? renderMobileActions(row)
                    : renderActions
                      ? renderActions(row)
                      : null}
                </Group>
              ) : null}
            </Card>
          );
        })}
      </Stack>
    </>
  );
}
