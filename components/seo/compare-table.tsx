type CompareRow = {
  feature: string;
  euclis: string;
  competitor: string;
};

type CompareTableProps = {
  competitorName: string;
  rows: CompareRow[];
};

/** Side-by-side comparison table for /compare/* pages. */
export function CompareTable({ competitorName, rows }: CompareTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-line">
            <th className="py-3 pr-4 font-semibold text-ink">Feature</th>
            <th className="py-3 pr-4 font-semibold text-ink">Euclis</th>
            <th className="py-3 font-semibold text-ink">{competitorName}</th>
          </tr>
        </thead>
        <tbody className="text-ink-soft">
          {rows.map((row) => (
            <tr key={row.feature} className="border-b border-line/60">
              <td className="py-3 pr-4 font-medium text-ink">{row.feature}</td>
              <td className="py-3 pr-4">{row.euclis}</td>
              <td className="py-3">{row.competitor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
