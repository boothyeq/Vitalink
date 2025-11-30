import { useQuery } from '@tanstack/react-query'
import { getAdminSummary } from '../lib/api'

export default function Admin() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-summary'],
    queryFn: getAdminSummary,
    refetchOnWindowFocus: false
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Admin Summary</h2>
        <button onClick={() => refetch()} className="text-sm px-3 py-1 border rounded">Refresh</button>
      </div>
      {isLoading && <p>Loading…</p>}
      {isError && <p className="text-red-600">Error: {(error as Error).message}</p>}
      {data && (
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Patient</th>
              <th className="p-2 text-left">Steps (latest)</th>
              <th className="p-2 text-left">HR (latest)</th>
              <th className="p-2 text-left">SpO2 (latest)</th>
            </tr>
          </thead>
          <tbody>
            {data.summary.map((row) => (
              <tr key={row.patientId} className="border-t">
                <td className="p-2">{row.patientId}</td>
                <td className="p-2">{row.steps ? `${row.steps.date} • ${row.steps.steps_total}` : '-'}</td>
                <td className="p-2">{row.hr ? `${row.hr.date} • min ${Math.round(row.hr.hr_min)} max ${Math.round(row.hr.hr_max)} avg ${Math.round(row.hr.hr_avg)}` : '-'}</td>
                <td className="p-2">{row.spo2 ? `${row.spo2.date} • avg ${Math.round(row.spo2.spo2_avg)}` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}