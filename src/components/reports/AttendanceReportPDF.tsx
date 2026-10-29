// components/reports/AttendanceReportPDF.tsx
// ต้องติดตั้ง: npm install @react-pdf/renderer
import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer';
import { Profile, PracticeSession, AttendanceRecord, SESSION_TYPE_LABELS, AttendanceStatus } from '@/types';
import { formatThaiDate } from '@/lib/utils';

// ---- Register Thai font ----
// (เคย register 'Pridi' ไว้ด้วย แต่พบบั๊ก glyph รวมสระ/วรรณยุกต์ผิดหลายจุด
// เลยเปลี่ยนมาใช้ Sarabun เป็นฟอนต์หลักทั้งฉบับแทน — ดูรายละเอียดด้านล่าง)

// Sarabun ใช้เป็นฟอนต์หลักของทั้งเอกสาร (เปลี่ยนจาก Pridi หลังพบว่า Pridi มีบั๊ก
// glyph รวมสระ/วรรณยุกต์ผิดกับ fontkit หลายจุด เช่น "เช้า" เพี้ยนเป็น "เข้า"
// และ "วิทย์" สระอิหลุดลอยออกจากคำ — เป็นปัญหาที่ตัวฟอนต์ ไม่ใช่โค้ด)
// (ลิงก์ Google Fonts CSS ใน index.html ใช้กับ react-pdf ไม่ได้ ต้องเป็น URL
// ไปที่ไฟล์ .ttf โดยตรงเท่านั้น)
 Font.register({
  family: 'Sarabun',
  fonts: [
    { src: '/fonts/Sarabun-Regular.ttf', fontWeight: 'normal' },
    { src: '/fonts/Sarabun-Bold.ttf',    fontWeight: 'bold'   },
  ],
 });

// Disable hyphenation
Font.registerHyphenationCallback(word => [word]);

// ---- Workaround: react-pdf/fontkit บั๊กกับข้อความไทย ----
// อาการ: ช่องว่างระหว่างคำกลายเป็น "&", ตัวอักษรตัวสุดท้ายของ text run หายไป
// สาเหตุ: font subsetting ของ fontkit map glyph ผิดกับบางอักขระไทย โดยเฉพาะ
// ตอน text run จบพอดีที่ตัวอักษรสุดท้าย หรือช่องว่างอยู่ติดกับสระ/วรรณยุกต์บางตัว
// วิธีแก้: (1) แทน space ปกติด้วย non-breaking space เพื่อเลี่ยง glyph ที่บั๊ก
//          (2) เติม zero-width space ต่อท้าย กัน fontkit ตัดตัวสุดท้ายทิ้ง
function sanitizeThaiForPdf(text: string): string {
  return text.replace(/ /g, '\u00A0') + '\u200B';
}

// ---- Styles ----
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Sarabun',
    fontSize: 8,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 42,
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
    minHeight: 24,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    minHeight: 20,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    minHeight: 20,
  },
  // Cells
  cellNo: { width: 22, paddingHorizontal: 3, paddingVertical: 3, justifyContent: 'center' },
  cellName: { flex: 1, paddingHorizontal: 4, paddingVertical: 3, justifyContent: 'center' },
  cellSession: { width: 32, paddingHorizontal: 2, paddingVertical: 3, alignItems: 'center', justifyContent: 'center' },
  cellSummary: { width: 24, paddingHorizontal: 2, paddingVertical: 3, alignItems: 'center', justifyContent: 'center' },
  // Page footer
  pageNumber: { position: 'absolute', bottom: 14, right: 24, fontSize: 7, color: '#999999', fontFamily: 'Sarabun' },
  // Text
  headerText: { color: '#ffffff', fontFamily: 'Sarabun', fontSize: 7 },
  cellText: { fontSize: 7.5, color: '#1a1a1a' },
  cellTextCenter: { fontSize: 7.5, color: '#1a1a1a', textAlign: 'center' },
  // Status symbols (ขาวดำ-friendly)
  symPresent: { fontSize: 8, fontFamily: 'Sarabun', fontWeight: 'bold', color: '#000000', textAlign: 'center' },
  symLate:    { fontSize: 8, fontFamily: 'Sarabun', fontWeight: 'bold', color: '#000000', textAlign: 'center' },
  symAbsent:  { fontSize: 8, fontFamily: 'Sarabun', fontWeight: 'bold', color: '#000000', textAlign: 'center' },
  symExcused: { fontSize: 8, fontFamily: 'Sarabun', fontWeight: 'bold', color: '#000000', textAlign: 'center' },
  symRd:      { fontSize: 6.5, fontFamily: 'Sarabun', color: '#666666', textAlign: 'center' },
  symEmpty:   { fontSize: 8, fontFamily: 'Sarabun', color: '#999999', textAlign: 'center' },
  // Legend
  // คำอธิบายสัญลักษณ์อยู่ท้ายทุกหน้า (fixed) — ไม่ให้หลุดไปอยู่หน้าเปล่าหน้าสุดท้ายเมื่อรายชื่อเต็มหน้าพอดี
  legend: { position: 'absolute', bottom: 14, left: 24, right: 80, flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
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
  statusMap: Record<string, AttendanceStatus | 'rd_exempt' | null>; // session.id → status
}

interface PDFProps {
  title: string;
  dateRange: string;
  sessions: ReportSession[];
  rows: ReportRow[];
}

// ---- Status symbol helper (ขาวดำ-friendly) ----
function StatusDot({ status }: { status: AttendanceStatus | 'rd_exempt' | null }) {
  if (status === 'present') return <Text style={styles.symPresent}>/</Text>;
  if (status === 'late')    return <Text style={styles.symLate}>ส</Text>;
  if (status === 'absent')  return <Text style={styles.symAbsent}>X</Text>;
  if (status === 'excused') return <Text style={styles.symExcused}>ล</Text>;
  if (status === 'rd_exempt') return <Text style={styles.symRd}>นศท.</Text>;
  return <Text style={styles.symEmpty}>—</Text>;
}

// react-pdf/fontkit บั๊ก: ตัวอักษรไทยที่มีวรรณยุกต์/การันต์ (่ ้ ๊ ๋ ์) ติดกับ "เว้นวรรค"
// ในสตริงเดียวกัน บางครั้ง shape ผิดกลายเป็น "&" หรือตัวสุดท้ายหาย — แก้โดยแยก render
// ชื่อ/นามสกุลเป็นคนละ Text node แล้วเว้นระยะด้วย marginLeft (ตัวเลข ไม่ใช่ตัวอักษร)
// แทนการฝังช่องว่างไว้ในสตริงต่อเนื่องเดียวกัน
function StudentName({ fullName, style }: { fullName: string; style?: any }) {
  const parts = fullName.trim().split(/\s+/);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {parts.map((part, i) => (
        <Text key={i} style={[style, i > 0 && { marginLeft: 3 }]} wrap={false}>
          {sanitizeThaiForPdf(part)}
        </Text>
      ))}
    </View>
  );
}

// วันจันทร์ของสัปดาห์ที่ session นั้นอยู่ — ใช้เป็น key สำหรับจัดกลุ่ม
function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  const dow = d.getUTCDay(); // 0=อา..6=ส
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMonday);
  return monday.toISOString().slice(0, 10);
}

// จัดหน้า: 1 หน้า = 1 สัปดาห์ (อ่านง่ายกว่าตัดตายตัวทุก N คอลัมน์)
// กันไว้เผื่อบางสัปดาห์มีคาบซ้อนผิดปกติ (ซ้อมเสริม/ข้อมูลซ้ำ) จนล้นความกว้างหน้ากระดาษ
function groupSessionsIntoPages(sessions: ReportSession[]): ReportSession[][] {
  const MAX_PER_PAGE = 12;
  const weeks: ReportSession[][] = [];
  let currentWeekKey: string | null = null;
  let current: ReportSession[] = [];
  for (const rs of sessions) {
    const wk = getWeekKey(rs.session.date);
    if (wk !== currentWeekKey) {
      if (current.length) weeks.push(current);
      current = [];
      currentWeekKey = wk;
    }
    current.push(rs);
  }
  if (current.length) weeks.push(current);

  const pages: ReportSession[][] = [];
  weeks.forEach(week => {
    for (let i = 0; i < week.length; i += MAX_PER_PAGE) {
      pages.push(week.slice(i, i + MAX_PER_PAGE));
    }
  });
  return pages.length ? pages : [[]];
}

// ---- PDF Document ----
function AttendanceDocument({ title, dateRange, sessions, rows }: PDFProps) {
  const chunks = groupSessionsIntoPages(sessions);

  return (
    <Document title={title}>
      {chunks.map((chunkSessions, chunkIdx) => {
        const weekStart = chunkSessions[0]?.session.date;
        const weekEnd = chunkSessions[chunkSessions.length - 1]?.session.date;
        const weekLabel = weekStart
          ? (weekStart === weekEnd ? formatThaiDate(weekStart) : `${formatThaiDate(weekStart)} – ${formatThaiDate(weekEnd)}`)
          : '';
        return (
        <Page key={chunkIdx} size="A4" orientation="portrait" style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>วงโยธวาทิต — รายงานการเข้าซ้อม</Text>
            <Text style={styles.subtitle}>{dateRange}</Text>
            {weekLabel !== '' && (
              <Text style={[styles.subtitle, { color: '#d97706', marginTop: 1 }]}>
                สัปดาห์ {weekLabel}{chunks.length > 1 ? ` · สัปดาห์ที่ ${chunkIdx + 1} จาก ${chunks.length}` : ''}
              </Text>
            )}
          </View>

          {/* Table */}
          <View style={styles.table}>
            {/* Table header row — fixed: พิมพ์ซ้ำทุกหน้ากระดาษเมื่อรายชื่อยาวเกิน 1 หน้า */}
            <View style={styles.tableHeader} wrap={false} fixed>
              <View style={styles.cellNo}>
                <Text style={styles.headerText}>#</Text>
              </View>
              <View style={styles.cellName}>
                <Text style={styles.headerText}>ชื่อ-นามสกุล</Text>
              </View>
              {/* Session columns */}
              {chunkSessions.map(({ session, dayLabel }) => (
                <View key={session.id} style={styles.cellSession}>
                  <Text style={[styles.headerText, { fontFamily: 'Sarabun', fontSize: 5.5, textAlign: 'center', lineHeight: 1.35 }]}>
                    {sanitizeThaiForPdf(dayLabel)}
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
                <View key={row.student.id} wrap={false} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <View style={styles.cellNo}>
                    <Text style={styles.cellTextCenter}>{idx + 1}</Text>
                  </View>
                  <View style={styles.cellName}>
                    <StudentName fullName={row.student.full_name} style={styles.cellText} />
                    {row.student.instrument?.name && (
                      <Text style={[styles.cellText, { color: '#999', fontSize: 6.5 }]} wrap={false}>
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
          <View style={styles.legend} fixed>
            {[
              { sym: '/', label: 'มาซ้อม' },
              { sym: 'ส', label: 'มาสาย' },
              { sym: 'X', label: 'ขาดซ้อม' },
              { sym: 'ล', label: 'ลา' },
              { sym: 'นศท.', label: 'ไป ร.ด. (ไม่นับขาด)' },
              { sym: '—', label: 'ไม่มีข้อมูล' },
            ].map(({ sym, label }) => (
              <View key={label} style={styles.legendItem}>
                <Text style={[styles.legendText, { fontFamily: 'Sarabun', color: '#000', marginRight: 2 }]}>{sym}</Text>
                <Text style={styles.legendText}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Page number */}
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `หน้า ${pageNumber} / ${totalPages}`}
            fixed
          />
        </Page>
        );
      })}
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