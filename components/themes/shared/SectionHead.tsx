import classes from './theme-shared.module.css';

/** A section heading: title (admin-editable) + accent bar. */
export default function SectionHead({ title }: { title: string }) {
  return (
    <div className={classes.sectionHead}>
      <h2 className={classes.sectionTitle}>{title}</h2>
      <span className={classes.sectionBar} />
    </div>
  );
}
