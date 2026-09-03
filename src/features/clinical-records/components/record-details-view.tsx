import type { RecordDetailsSection } from '../lib/record-details-presentation';
import styles from './record-details-view.module.css';

interface RecordDetailsViewProps {
  sections: RecordDetailsSection[];
  headingLevel?: 2 | 3;
  variant?: 'default' | 'compact';
}

export function RecordDetailsView({
  sections,
  headingLevel = 2,
  variant = 'default',
}: RecordDetailsViewProps) {
  if (sections.length === 0) return null;

  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <div className={`${styles.root} ${variant === 'compact' ? styles.compact : ''}`}>
      {sections.map((section) => (
        <section key={section.id} className={styles.section}>
          <Heading className={styles.sectionTitle}>{section.title}</Heading>

          <div className={styles.blocks}>
            {section.blocks.map((block) => {
              if (block.kind === 'fields') {
                return (
                  <dl key={block.key} className={styles.fields}>
                    {block.fields.map((field) => (
                      <div
                        key={field.key}
                        className={`${styles.field} ${field.wide ? styles.fieldWide : ''}`}
                      >
                        <dt className={styles.label}>{field.label}</dt>
                        <dd className={styles.value}>{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                );
              }

              if (block.kind === 'list') {
                return (
                  <div key={block.key} className={styles.listBlock}>
                    <p className={styles.label}>{block.label}</p>
                    <ul className={styles.list}>
                      {block.items.map((item, index) => (
                        <li key={`${block.key}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                );
              }

              return (
                <div key={block.key} className={styles.tableBlock}>
                  <p className={styles.label}>{block.label}</p>
                  <div
                    className={styles.tableViewport}
                    role="region"
                    aria-label={block.label}
                    tabIndex={0}
                  >
                    <table className={styles.table}>
                      <caption className={styles.visuallyHidden}>{block.label}</caption>
                      <thead>
                        <tr>
                          {block.columns.map((column) => (
                            <th key={column.key} scope="col">
                              {column.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows.map((row, rowIndex) => (
                          <tr key={`${block.key}-${rowIndex}`}>
                            {row.map((cell, columnIndex) => (
                              <td
                                key={`${block.key}-${rowIndex}-${block.columns[columnIndex].key}`}
                                data-label={block.columns[columnIndex].label}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
