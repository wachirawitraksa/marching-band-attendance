// components/reports/AttendanceReportPDF.tsx
// ต้องติดตั้ง: npm install @react-pdf/renderer
import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer';
import { Profile, PracticeSession, AttendanceRecord, SESSION_TYPE_LABELS, AttendanceStatus } from '@/types';
import { formatThaiDate } from '@/lib/utils';

// ---- Register Thai font ----
Font.register({
  family: 'Sarabun',
  fonts: [
    { src: '/fonts/Sarabun-Regular.ttf', fontWeight: 'normal' },
    { src: '/fonts/Sarabun-Bold.ttf',    fontWeight: 'bold'   },
  ],
});

// Disable hyphenation
Font.registerHyphenationCallback(word => [word]);

// ---- Styles ----
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Sarabun',
    fontSize: 8,
    padding: 24,
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: '#d97706',
    paddingBottom: 8,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Sarabun',
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 8,
    color: '#666666',
  },
  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    minHeight: 20,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    minHeight: 18,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    minHeight: 18,
  },
  // Cells
  cellNo: { width: 22, paddingHorizontal: 3, paddingVertical: 3, justifyContent: 'center' },
  cellName: { flex: 1, paddingHorizontal: 4, paddingVertical: 3, justifyContent: 'center' },
  cellSession: { width: 28, paddingHorizontal: 2, paddingVertical: 3, alignItems: 'center', justifyContent: 'center' },
  cellSummary: { width: 24, paddingHorizontal: 2, paddingVertical: 3, alignItems: 'center', justifyContent: 'center' },
  // Text
  headerText: { color: '#ffffff', fontFamily: 'Sarabun', fontSize: 7 },
  cellText: { fontSize: 7.5, color: '#1a1a1a' },
  cellTextCenter: { fontSize: 7.5, color: '#1a1a1a', textAlign: 'center' },
  // Status symbols (ขาวดำ-friendly)
  symPresent: { fontSize: 8, fontFamily: 'Sarabun', fontWeight: 'bold', color: '#000000', textAlign: 'center' },
  symLate:    { fontSize: 8, fontFamily: 'Sarabun', fontWeight: 'bold', color: '#000000', textAlign: 'center' },
  symAbsent:  { fontSize: 8, fontFamily: 'Sarabun', fontWeight: 'bold', color: '#000000', textAlign: 'center' },
  symExcused: { fontSize: 8, fontFamily: 'Sarabun', fontWeight: 'bold', color: '#000000', textAlign: 'center' },
  symEmpty:   { fontSize: 8, fontFamily: 'Sarabun', color: '#999999', textAlign: 'center' },
  // Legend
  legend: { flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontSize: 7, color: '#666' },
  // Summary header
  summaryLabel: { fontSize: 7, color: '#d97706', fontFamily: 'Sarabun', fontWeight: 'bold', textAlign: 'center' },
  summaryPresent: { fontSize: 7, color: '#22c55e', fontFamily: 'Sarabun', fontWeight: 'bold', textAlign: 'center' },
  summaryLate:    { fontSize: 7, color: '#eab308', fontFamily: 'Sarabun', fontWeight: 'bold', textAlign: 'center' },
  summaryAbsent:  { fontSize: 7, color: '#ef4444', fontFamily: 'Sarabun', fontWeight: 'bold', textAlign: 'center' },
  summaryExcused: { fontSize: 7, color: '#3b82f6', fontFamily: 'Sarabun', fontWeight: 'bold', textAlign: 'center' },
});

// ---- Types ----
export interface ReportSession {
  session: PracticeSession;
  dayLabel: string; // เช่น "จ\n19/06"
}

export interface ReportRow {
  student: Profile;
  statusMap: Record<string, AttendanceStatus | null>; // session.id → status
}

interface PDFProps {
  title: string;
  dateRange: string;
  sessions: ReportSession[];
  rows: ReportRow[];
}

// ---- Status symbol helper (ขาวดำ-friendly) ----
function StatusDot({ status }: { status: AttendanceStatus | null }) {
  if (status === 'present') return <Text style={styles.symPresent}>/</Text>;
  if (status === 'late')    return <Text style={styles.symLate}>ส</Text>;
  if (status === 'absent')  return <Text style={styles.symAbsent}>X</Text>;
  if (status === 'excused') return <Text style={styles.symExcused}>ล</Text>;
  return <Text style={styles.symEmpty}>—</Text>;
}

// ---- PDF Document ----
function AttendanceDocument({ title, dateRange, sessions, rows }: PDFProps) {
  // แบ่ง sessions เป็น chunks ถ้ามีเยอะ (landscape จุได้ประมาณ 20 sessions)
  const SESSIONS_PER_PAGE = 18;
  const chunks: ReportSession[][] = [];
  for (let i = 0; i < sessions.length; i += SESSIONS_PER_PAGE) {
    chunks.push(sessions.slice(i, i + SESSIONS_PER_PAGE));
  }
  if (chunks.length === 0) chunks.push([]);

  return (
    <Document title={title}>
      {chunks.map((chunkSessions, chunkIdx) => (
        <Page key={chunkIdx} size="A4" orientation="landscape" style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>วงโยธวาทิต — รายงานการเข้าซ้อม</Text>
            <Text style={styles.subtitle}>{dateRange}{chunkIdx > 0 ? ` (ต่อ ${chunkIdx + 1})` : ''}</Text>
          </View>

          {/* Table */}
          <View style={styles.table}>
            {/* Table header row */}
            <View style={styles.tableHeader}>
              <View style={styles.cellNo}>
                <Text style={styles.headerText}>#</Text>
              </View>
              <View style={styles.cellName}>
                <Text style={styles.headerText}>ชื่อ-นามสกุล</Text>
              </View>
              {/* Session columns */}
              {chunkSessions.map(({ session, dayLabel }) => (
                <View key={session.id} style={styles.cellSession}>
                  <Text style={[styles.headerText, { fontSize: 6, textAlign: 'center' }]}>
                    {dayLabel}
                  </Text>
                </View>
              ))}
              {/* Summary */}
              <View style={styles.cellSummary}><Text style={styles.summaryPresent}>มา</Text></View>
              <View style={styles.cellSummary}><Text style={styles.summaryLate}>สาย</Text></View>
              <View style={styles.cellSummary}><Text style={styles.summaryAbsent}>ขาด</Text></View>
              <View style={styles.cellSummary}><Text style={styles.summaryExcused}>ลา</Text></View>
            </View>

            {/* Data rows */}
            {rows.map((row, idx) => {
              const present = Object.values(row.statusMap).filter(s => s === 'present').length;
              const late    = Object.values(row.statusMap).filter(s => s === 'late').length;
              const absent  = Object.values(row.statusMap).filter(s => s === 'absent').length;
              const excused = Object.values(row.statusMap).filter(s => s === 'excused').length;

              return (
                <View key={row.student.id} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <View style={styles.cellNo}>
                    <Text style={styles.cellTextCenter}>{idx + 1}</Text>
                  </View>
                  <View style={styles.cellName}>
                    <Text style={styles.cellText}>{row.student.full_name}</Text>
                    {row.student.instrument?.name && (
                      <Text style={[styles.cellText, { color: '#999', fontSize: 6.5 }]}>
                        {row.student.instrument.name}
                      </Text>
                    )}
                  </View>
                  {chunkSessions.map(({ session }) => (
                    <View key={session.id} style={[styles.cellSession, { alignItems: 'center', justifyContent: 'center' }]}>
                      <StatusDot status={row.statusMap[session.id] ?? null} />
                    </View>
                  ))}
                  <View style={styles.cellSummary}>
                    <Text style={[styles.cellTextCenter, { color: '#22c55e', fontFamily: 'Sarabun' }]}>{present || '-'}</Text>
                  </View>
                  <View style={styles.cellSummary}>
                    <Text style={[styles.cellTextCenter, { color: '#eab308', fontFamily: 'Sarabun' }]}>{late || '-'}</Text>
                  </View>
                  <View style={styles.cellSummary}>
                    <Text style={[styles.cellTextCenter, { color: '#ef4444', fontFamily: 'Sarabun' }]}>{absent || '-'}</Text>
                  </View>
                  <View style={styles.cellSummary}>
                    <Text style={[styles.cellTextCenter, { color: '#3b82f6', fontFamily: 'Sarabun' }]}>{excused || '-'}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            {[
              { sym: '/', label: 'มาซ้อม' },
              { sym: 'ส', label: 'มาสาย' },
              { sym: 'X', label: 'ขาดซ้อม' },
              { sym: 'ล', label: 'ลา' },
              { sym: '—', label: 'ไม่มีข้อมูล' },
            ].map(({ sym, label }) => (
              <View key={label} style={styles.legendItem}>
                <Text style={[styles.legendText, { fontFamily: 'Sarabun', color: '#000', marginRight: 2 }]}>{sym}</Text>
                <Text style={styles.legendText}>{label}</Text>
              </View>
            ))}
          </View>
        </Page>
      ))}
    </Document>
  );
}

// ---- Export function (เรียกจาก ExportReportDialog) ----
export async function downloadAttendancePDF(props: PDFProps) {
  const blob = await pdf(<AttendanceDocument {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export { AttendanceDocument };