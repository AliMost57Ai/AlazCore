// // components/PersianDateTimePicker/styles.ts
// 'use client';

// import  createStyles  from '@mantine/core';

// export const useStyles = createStyles((theme) => ({
//   wrapper: {
//     width: '100%',
//     maxWidth: 400,
//   },

//   input: {
//     cursor: 'pointer',
//     '& input': {
//       cursor: 'pointer',
//     },
//   },

//   popoverDropdown: {
//     width: '100%',
//     maxWidth: 380,
//     padding: theme.spacing.md,

//     [`@media (max-width: ${theme.breakpoints.sm})`]: {
//       padding: theme.spacing.sm,
//       maxWidth: 'calc(100vw - 32px)',
//       margin: '0 16px',
//     },
//   },

//   calendarWrapper: {
//     width: '100%',
//   },

//   header: {
//     padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
//     marginBottom: theme.spacing.xs,

//     [`@media (max-width: ${theme.breakpoints.sm})`]: {
//       padding: `${theme.spacing.xs}px ${theme.spacing.xs}px`,
//     },
//   },

//   monthYearGroup: {
//     gap: theme.spacing.xs,

//     [`@media (max-width: ${theme.breakpoints.sm})`]: {
//       gap: theme.spacing.xs / 2,
//     },
//   },

//   monthSelect: {
//     minWidth: 120,

//     [`@media (max-width: ${theme.breakpoints.sm})`]: {
//       minWidth: 100,
//       flex: 1,
//     },
//   },

//   yearSelect: {
//     minWidth: 90,

//     [`@media (max-width: ${theme.breakpoints.sm})`]: {
//       minWidth: 80,
//       flex: 1,
//     },
//   },

//   dayCell: {
//     minHeight: 32,
//     height: 32,
//     padding: 0,

//     [`@media (max-width: ${theme.breakpoints.sm})`]: {
//       minHeight: 28,
//       height: 28,
//       fontSize: theme.fontSizes.xs,
//     },
//   },

//   dayButton: {
//     width: '100%',
//     height: '100%',
//     minHeight: 'unset',
//     padding: 0,

//     [`@media (max-width: ${theme.breakpoints.sm})`]: {
//       fontSize: theme.fontSizes.xs,
//     },
//   },

//   weekDay: {
//     fontSize: theme.fontSizes.xs,
//     fontWeight: 600,

//     [`@media (max-width: ${theme.breakpoints.sm})`]: {
//       fontSize: theme.fontSizes.xs,
//     },
//   },

//   timeGroup: {
//     gap: theme.spacing.sm,

//     [`@media (max-width: ${theme.breakpoints.sm})`]: {
//       gap: theme.spacing.xs,
//       flexDirection: 'column',
//     },
//   },

//   timeInput: {
//     flex: 1,

//     [`@media (max-width: ${theme.breakpoints.sm})`]: {
//       width: '100%',
//     },
//   },

//   actionButtons: {
//     gap: theme.spacing.sm,

//     [`@media (max-width: ${theme.breakpoints.sm})`]: {
//       gap: theme.spacing.xs,
//     },
//   },

//   formatSwitcher: {
//     marginBottom: theme.spacing.sm,

//     [`@media (max-width: ${theme.breakpoints.sm})`]: {
//       marginBottom: theme.spacing.xs,
//     },
//   },

//   legend: {
//     gap: theme.spacing.sm,
//     marginTop: theme.spacing.sm,

//     [`@media (max-width: ${theme.breakpoints.sm})`]: {
//       gap: theme.spacing.xs,
//       marginTop: theme.spacing.xs,
//     },
//   },

//   legendItem: {
//     gap: 4,
//     alignItems: 'center',
//   },

//   legendDot: {
//     width: 8,
//     height: 8,
//     borderRadius: '50%',
//   },

//   formatsPreview: {
//     marginTop: theme.spacing.xs,
//     gap: theme.spacing.xs,
//     flexWrap: 'wrap',

//     [`@media (max-width: ${theme.breakpoints.sm})`]: {
//       gap: theme.spacing.xs / 2,
//     },
//   },
// }));
