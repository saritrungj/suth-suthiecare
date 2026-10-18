import "./DataPanel.css";

// The one surface every management list sits on, in the dashboard section
// look. It replaces a page's own card element (pass that card's class in
// `className` so page layout rules keep working) instead of nesting inside
// it, so a list never shows a card within a card. Children are the toolbar,
// the result line, the table and the pagination, in that order.
export default function DataPanel({
  as: Tag = "section",
  className = "",
  children,
  ...rest
}) {
  return (
    <Tag className={("dz-panel " + className).trim()} {...rest}>
      {children}
    </Tag>
  );
}
