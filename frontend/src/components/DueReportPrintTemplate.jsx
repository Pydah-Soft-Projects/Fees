import React, { forwardRef } from 'react';

const DueReportPrintTemplate = forwardRef(({
    type = 'overall',
    reportData = [],
    filters = {},
    summary = {},
    student = {},
    includeDetails = false,
    printedOn: printedOnProp,
    reportMode = 'academicYear',
    batchYearsList = []
}, ref) => {
    const isBatchMode = reportMode === 'batch' || filters.reportMode === 'batch';
    const fmtAmount = (val) => Number(val || 0).toLocaleString('en-IN');

    const formatPrintedOn = () => {
        if (printedOnProp) return printedOnProp;
        return `${new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        })} IST`;
    };

    const formatTermDate = (d) => {
        if (!d) return null;
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return null;
        return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatTermDateShort = (d) => {
        if (!d) return null;
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return null;
        return `${dt.getDate()} ${dt.toLocaleString('en-US', { month: 'short' })}`;
    };

    // Dynamic term count (Academic Year Mode)
    let maxTerms = 1;
    if (type === 'individual') {
        const studentInfo = student || {};
        let maxT = 1;
        ['academic', 'hostel', 'transport'].forEach((c) => {
            const catData = studentInfo.groupedFeeDetails?.[c];
            if (catData?.terms) {
                maxT = Math.max(maxT, ...catData.terms.map((t) => Number(t.termNumber) || 0), catData.terms.length);
            }
        });
        if (studentInfo.termDues?.length > maxT) maxT = studentInfo.termDues.length;
        maxTerms = Math.max(1, maxT);
    } else if (reportData?.length > 0) {
        const counts = reportData.map((st) => st.termDues?.length || 0);
        maxTerms = Math.max(1, ...counts);
    }

    // Dynamic batch years (Batch Wise Mode)
    const resolvedBatchYears = (() => {
        if (batchYearsList && batchYearsList.length > 0) return batchYearsList;
        const source = type === 'individual' ? [student].filter(Boolean) : (reportData || []);
        let maxFound = 1;
        source.forEach(st => {
            if (st.yearDues) {
                Object.keys(st.yearDues).forEach(y => {
                    if (Number(y) > maxFound) maxFound = Number(y);
                });
            }
            if (st.current_year && Number(st.current_year) > maxFound) {
                maxFound = Number(st.current_year);
            }
        });
        const maxYear = Math.max(maxFound, 2);
        const list = [];
        for (let i = 1; i <= maxYear; i++) list.push(i);
        return list;
    })();

    // Most-common due date per term column (Academic Year Mode)
    const termHeaderDates = (() => {
        const source = type === 'individual' ? [student].filter(Boolean) : (reportData || []);
        const dateCounts = {};
        source.forEach((st) => {
            (st.termDueDates || []).forEach((d, i) => {
                if (!d) return;
                const termIdx = i + 1;
                if (!dateCounts[termIdx]) dateCounts[termIdx] = {};
                const key = new Date(d).toISOString().slice(0, 10);
                dateCounts[termIdx][key] = (dateCounts[termIdx][key] || 0) + 1;
            });
            ['academic', 'hostel', 'transport'].forEach((c) => {
                (st.groupedFeeDetails?.[c]?.terms || []).forEach((t) => {
                    if (!t?.dueDate) return;
                    const termIdx = Number(t.termNumber) || 0;
                    if (!termIdx) return;
                    if (!dateCounts[termIdx]) dateCounts[termIdx] = {};
                    const key = new Date(t.dueDate).toISOString().slice(0, 10);
                    dateCounts[termIdx][key] = (dateCounts[termIdx][key] || 0) + 1;
                });
            });
        });
        const result = [];
        for (let i = 1; i <= maxTerms; i++) {
            if (dateCounts[i]) {
                const best = Object.entries(dateCounts[i]).sort((a, b) => b[1] - a[1])[0];
                result.push(formatTermDate(best[0]));
            } else {
                result.push(null);
            }
        }
        return result;
    })();

    // Colgroup for Academic Year Mode
    const baseColCount = 4;
    const totalColCount = baseColCount + 3 + maxTerms + 3;

    const renderColGroup = () => (
        <colgroup>
            <col style={{ width: '24px' }} />
            <col style={{ width: '68px' }} />
            <col style={{ width: '68px' }} />
            <col style={{ width: '150px' }} />
            <col style={{ width: '54px' }} />
            <col style={{ width: '50px' }} />
            <col style={{ width: '50px' }} />
            {Array.from({ length: maxTerms }).map((_, i) => (
                <col key={i} style={{ width: '54px' }} />
            ))}
            <col style={{ width: '56px' }} />
            <col style={{ width: '56px' }} />
            <col style={{ width: '58px' }} />
        </colgroup>
    );

    // Colgroup for Batch Wise Mode
    const batchColCount = 5 + resolvedBatchYears.length + 1;
    const renderBatchColGroup = () => (
        <colgroup>
            <col style={{ width: '26px' }} />
            <col style={{ width: '75px' }} />
            <col style={{ width: '75px' }} />
            <col style={{ width: '160px' }} />
            <col style={{ width: '120px' }} />
            {resolvedBatchYears.map(yr => (
                <col key={yr} style={{ width: '68px' }} />
            ))}
            <col style={{ width: '75px' }} />
        </colgroup>
    );

    const thStyle = {
        border: '1px solid #000',
        padding: '4px 3px',
        color: '#000',
        fontWeight: 'bold',
        fontSize: '8.5px',
        backgroundColor: '#fff'
    };
    const tdStyle = {
        border: '1px solid #000',
        padding: '3px 3px',
        color: '#000',
        fontSize: '8.5px',
        backgroundColor: '#fff'
    };

    // Category breakdown for Academic Year
    const renderBreakdownTable = (st, maxTermsVal) => {
        const categories = [
            { key: 'academic', label: 'Academic Fees' },
            { key: 'hostel', label: 'Hostel Fee' },
            { key: 'transport', label: 'Transport Fee' }
        ].filter((c) => st.groupedFeeDetails?.[c.key]);

        if (categories.length === 0) {
            return <div style={{ padding: '6px', fontStyle: 'italic', color: '#000', fontSize: '9px' }}>No breakdown details found.</div>;
        }

        const totalFee = st.totalFee !== undefined ? st.totalFee : categories.reduce((sum, cat) => sum + Number(st.groupedFeeDetails[cat.key].total || 0), 0);
        const concession = st.concessionAmount !== undefined ? st.concessionAmount : categories.reduce((sum, cat) => sum + Number(st.groupedFeeDetails[cat.key].concession || 0), 0);
        const paidAmount = st.paidAmount !== undefined ? st.paidAmount : categories.reduce((sum, cat) => sum + Number(st.groupedFeeDetails[cat.key].paid || 0), 0);
        const previousDue = Number(st.previousDue || 0);
        const activeDue = Number(st.activeDue || 0);
        const dueAmount = Number(st.dueAmount || 0);

        const termTotals = Array.from({ length: maxTermsVal }).map((_, i) =>
            categories.reduce((sum, cat) => {
                const catData = st.groupedFeeDetails[cat.key];
                const termObj = (catData.terms || []).find((t) => Number(t.termNumber) === i + 1);
                return sum + (termObj ? termObj.balance || 0 : 0);
            }, 0)
        );

        return (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5px', marginTop: '4px', border: '1px solid #000' }}>
                <thead>
                    <tr>
                        <th style={{ ...thStyle, textAlign: 'left' }}>Fee Category</th>
                        <th style={{ ...thStyle, textAlign: 'right', width: '65px' }}>Total Fee</th>
                        <th style={{ ...thStyle, textAlign: 'right', width: '60px' }}>Concession</th>
                        <th style={{ ...thStyle, textAlign: 'right', width: '60px' }}>Paid</th>
                        {Array.from({ length: maxTermsVal }).map((_, i) => (
                            <th key={i} style={{ ...thStyle, textAlign: 'right', width: '60px' }}>
                                <div>T{i + 1} Due</div>
                                {termHeaderDates[i] && (
                                    <div style={{ fontSize: '7px', fontWeight: 'normal', color: '#000', marginTop: '1px' }}>{termHeaderDates[i]}</div>
                                )}
                            </th>
                        ))}
                        <th style={{ ...thStyle, textAlign: 'right', width: '65px' }}>Previous Due</th>
                        <th style={{ ...thStyle, textAlign: 'right', width: '65px' }}>Active Due</th>
                        <th style={{ ...thStyle, textAlign: 'right', width: '65px', backgroundColor: '#ececec' }}>Total Due</th>
                    </tr>
                </thead>
                <tbody>
                    {categories.map((cat) => {
                        const catData = st.groupedFeeDetails[cat.key];
                        const catActiveDue = (catData.terms || []).reduce((acc, t) => acc + (t.isActiveTerm ? (t.balance || 0) : 0), 0);
                        return (
                            <tr key={cat.key}>
                                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{cat.label}</td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>₹{fmtAmount(catData.total)}</td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>₹{fmtAmount(catData.concession)}</td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>₹{fmtAmount(catData.paid)}</td>
                                {Array.from({ length: maxTermsVal }).map((_, i) => {
                                    const termObj = (catData.terms || []).find((t) => Number(t.termNumber) === i + 1);
                                    const termBalance = termObj ? termObj.balance || 0 : 0;
                                    const termTarget = termObj ? termObj.termTarget || 0 : 0;
                                    const termConc = termObj ? termObj.concessionShare || 0 : 0;
                                    const fTermDate = formatTermDateShort(termObj?.dueDate);

                                    return (
                                        <td key={i} style={{ ...tdStyle, textAlign: 'right' }}>
                                            <div style={{ fontWeight: termBalance > 0 ? 'bold' : 'normal', color: '#000' }}>
                                                ₹{fmtAmount(termBalance)}
                                            </div>
                                            {termTarget > 0 && (
                                                <div style={{ fontSize: '7px', color: '#555', fontWeight: 'normal', marginTop: '1px' }}>
                                                    Target: ₹{fmtAmount(termTarget)}
                                                    {termConc > 0 && ` (Conc: ₹${fmtAmount(termConc)})`}
                                                </div>
                                            )}
                                            {termBalance > 0 && fTermDate && (
                                                <div style={{ fontSize: '7px', color: '#555', fontWeight: 'normal', fontFamily: 'monospace', marginTop: '1px' }}>{fTermDate}</div>
                                            )}
                                        </td>
                                    );
                                })}
                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: (catData.previousDue || 0) > 0 ? 'bold' : 'normal' }}>
                                    ₹{fmtAmount(catData.previousDue || 0)}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>₹{fmtAmount(catActiveDue)}</td>
                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', backgroundColor: '#ececec' }}>₹{fmtAmount(catData.due)}</td>
                            </tr>
                        );
                    })}
                    <tr style={{ fontWeight: 'bold' }}>
                        <td style={{ ...tdStyle, fontWeight: 'bold', textAlign: 'left', backgroundColor: '#f9f9f9' }}>GRAND TOTAL</td>
                        <td style={{ ...tdStyle, textAlign: 'right', backgroundColor: '#f9f9f9' }}>₹{fmtAmount(totalFee)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', backgroundColor: '#f9f9f9' }}>₹{fmtAmount(concession)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', backgroundColor: '#f9f9f9' }}>₹{fmtAmount(paidAmount)}</td>
                        {termTotals.map((termTotal, idx) => (
                            <td key={idx} style={{ ...tdStyle, textAlign: 'right', backgroundColor: '#f9f9f9' }}>₹{fmtAmount(termTotal)}</td>
                        ))}
                        <td style={{ ...tdStyle, textAlign: 'right', backgroundColor: '#f9f9f9' }}>₹{fmtAmount(previousDue)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', backgroundColor: '#f9f9f9' }}>₹{fmtAmount(activeDue)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', backgroundColor: '#ececec' }}>₹{fmtAmount(dueAmount)}</td>
                    </tr>
                </tbody>
            </table>
        );
    };

    // Fee Head breakdown for Batch Wise Mode
    const renderBatchBreakdownTable = (st, yearsList) => {
        const breakdowns = (st.feeHeadYearBreakdown || []).filter(fh => 
            (fh.totalDue || 0) > 0 || yearsList.some(yr => (fh.yearDues?.[yr] || 0) > 0)
        );

        if (breakdowns.length === 0) {
            return (
                <div style={{ padding: '6px', fontStyle: 'italic', color: '#000', fontSize: '9px' }}>
                    No fee breakdown details found.
                </div>
            );
        }

        return (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', marginTop: '4px', border: '1px solid #000' }}>
                <thead>
                    <tr>
                        <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'left', fontWeight: 'bold', color: '#000', backgroundColor: '#fff' }}>Fee Head</th>
                        {yearsList.map(yr => (
                            <th key={yr} style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold', width: '70px', color: '#000', backgroundColor: '#fff' }}>
                                Year {yr} Due
                            </th>
                        ))}
                        <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold', width: '75px', color: '#000', backgroundColor: '#ececec' }}>Total Due</th>
                    </tr>
                </thead>
                <tbody>
                    {breakdowns.map((fh, idx) => (
                        <tr key={fh.headId || idx}>
                            <td style={{ border: '1px solid #000', padding: '4px 6px', fontWeight: 'bold', color: '#000', backgroundColor: '#fff' }}>
                                {fh.headName} {fh.headCode ? `(${fh.headCode})` : ''}
                            </td>
                            {yearsList.map(yr => {
                                const dVal = fh.yearDues?.[yr] || 0;
                                return (
                                    <td key={yr} style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', color: '#000', backgroundColor: '#fff' }}>
                                        ₹{fmtAmount(dVal)}
                                    </td>
                                );
                            })}
                            <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold', color: '#000', backgroundColor: '#ececec' }}>
                                ₹{fmtAmount(fh.totalDue)}
                            </td>
                        </tr>
                    ))}
                    <tr style={{ fontWeight: 'bold' }}>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left', color: '#000', backgroundColor: '#fff' }}>TOTAL DUES</td>
                        {yearsList.map(yr => {
                            const yTot = st.yearDues?.[yr] || 0;
                            return (
                                <td key={yr} style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', color: '#000', backgroundColor: '#fff' }}>
                                    ₹{fmtAmount(yTot)}
                                </td>
                            );
                        })}
                        <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', color: '#000', fontWeight: 'bold', backgroundColor: '#ececec' }}>
                            ₹{fmtAmount(st.dueAmount)}
                        </td>
                    </tr>
                </tbody>
            </table>
        );
    };

    // ==========================================
    // 1. INDIVIDUAL STATEMENT
    // ==========================================
    if (type === 'individual') {
        const studentInfo = student || {};
        const printedOn = formatPrintedOn();

        return (
            <div ref={ref} style={{ padding: '16px 18px', fontFamily: 'Arial, sans-serif', color: '#000', backgroundColor: '#fff' }}>
                <style type="text/css">
                    {`
                        @page { size: A4 landscape; margin: 6mm; }
                        @media print {
                            @page { size: A4 landscape; margin: 6mm; }
                            body { background-color: #fff; }
                        }
                    `}
                </style>

                {/* Institutional Header matching Overall Print */}
                <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '6px', marginBottom: '8px' }}>
                    <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>Pydah Group of Colleges</h1>
                    <p style={{ margin: '3px 0', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                        {isBatchMode ? 'INDIVIDUAL BATCH DUE STATEMENT' : 'INDIVIDUAL ACADEMIC DUE STATEMENT'} AS ON DATE : {printedOn}
                    </p>
                </div>

                {/* Student Info Box matching Overall Print Filter Box format */}
                <div style={{ border: '1px solid #000', padding: '6px 10px', marginBottom: '10px', fontSize: '9px', display: 'flex', flexWrap: 'wrap', gap: '4px 16px', backgroundColor: '#fff' }}>
                    <div><strong>Student Name:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{studentInfo.student_name}</span></div>
                    <div><strong>Admission No:</strong> <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{studentInfo.admission_number || '-'}</span></div>
                    <div><strong>PIN Number:</strong> <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{studentInfo.pin_no || '-'}</span></div>
                    <div><strong>College:</strong> {studentInfo.college || filters.college || '-'}</div>
                    <div><strong>Course:</strong> {studentInfo.course || filters.course || '-'}</div>
                    <div><strong>Branch:</strong> {studentInfo.branch || filters.branch || '-'}</div>
                    {isBatchMode ? (
                        <div><strong>Batch:</strong> <span style={{ fontWeight: 'bold' }}>{studentInfo.batch || filters.batch || '-'}</span></div>
                    ) : (
                        <div><strong>Academic Year:</strong> Year {studentInfo.current_year || studentInfo.year || filters.year || '-'}</div>
                    )}
                    <div><strong>Status:</strong> {studentInfo.student_status || studentInfo.studentStatus || 'Active'}</div>
                    <div><strong>Quota:</strong> {studentInfo.stud_type || studentInfo.quota || '-'}</div>
                    <div><strong>Scholarship:</strong> {String(studentInfo.scholarshipStatus).toLowerCase() === 'eligible' ? 'Eligible' : 'Not Eligible'}</div>
                    <div><strong>Active Due:</strong> <span style={{ fontWeight: 'bold' }}>₹{fmtAmount(studentInfo.activeDue)}</span></div>
                    <div><strong>Total Due:</strong> <span style={{ fontWeight: 'bold' }}>₹{fmtAmount(studentInfo.dueAmount)}</span></div>
                </div>

                <div style={{ fontSize: '9.5px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>
                    {isBatchMode ? 'Fee Head Wise Year Dues Breakdown' : 'Fee Category & Term Dues Breakdown'}
                </div>

                <div>
                    {isBatchMode
                        ? renderBatchBreakdownTable(studentInfo, resolvedBatchYears)
                        : renderBreakdownTable(studentInfo, maxTerms)}
                </div>
            </div>
        );
    }

    // ==========================================
    // 2. OVERALL REPORT - BATCH WISE MODE
    // ==========================================
    if (isBatchMode) {
        const totalStudents = reportData.length;
        const grandBatchTotals = {};
        resolvedBatchYears.forEach(yr => { grandBatchTotals[yr] = 0; });
        (reportData || []).forEach(st => {
            resolvedBatchYears.forEach(yr => {
                grandBatchTotals[yr] += Number(st.yearDues?.[yr] || 0);
            });
        });
        const grandBatchDueTotal = (reportData || []).reduce((sum, s) => sum + Number(s.dueAmount || 0), 0);

        // Sort students by PIN / Adm No
        const sortedStudents = [...(reportData || [])].sort((a, b) => {
            const pinA = String(a.pin_no || a.admission_number || '').trim();
            const pinB = String(b.pin_no || b.admission_number || '').trim();
            return pinA.localeCompare(pinB, undefined, { numeric: true, sensitivity: 'base' });
        });

        const printedOn = formatPrintedOn();
        const activeDueCellBg = '#ececec';

        return (
            <div ref={ref} style={{ fontFamily: 'Arial, sans-serif', color: '#000', backgroundColor: '#fff' }}>
                <style type="text/css">
                    {`
                        @page { size: A4 landscape; margin: 6mm; }
                        @media print {
                            @page { size: A4 landscape; margin: 6mm; }
                            body { background-color: #fff; }
                            .page-break { page-break-before: always; break-before: page; }
                        }
                    `}
                </style>

                <div style={{ padding: '16px 18px' }}>
                    <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '6px', marginBottom: '8px' }}>
                        <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>Pydah Group of Colleges</h1>
                        <p style={{ margin: '3px 0', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                            BATCH DUE REPORT AS ON DATE : {printedOn} {filters.batch ? `— BATCH : ${filters.batch}` : ''}
                        </p>
                    </div>

                    <div style={{ border: '1px solid #000', padding: '5px 8px', marginBottom: '8px', fontSize: '9px', display: 'flex', flexWrap: 'wrap', gap: '3px 14px', backgroundColor: '#fff' }}>
                        {filters.college && <div><strong>College:</strong> {filters.college}</div>}
                        {filters.course && <div><strong>Course:</strong> {filters.course}</div>}
                        {filters.branch && <div><strong>Branch:</strong> {filters.branch}</div>}
                        {filters.batch && <div><strong>Batch:</strong> {filters.batch}</div>}
                        {filters.quota && <div><strong>Quota:</strong> {filters.quota}</div>}
                        {filters.studentStatus && <div><strong>Status:</strong> {filters.studentStatus}</div>}
                        {filters.scholarshipMode && <div><strong>Scholarship:</strong> {filters.scholarshipMode}</div>}
                        {filters.feeHeads && <div><strong>Fee Heads:</strong> {filters.feeHeads}</div>}
                        {filters.search && <div><strong>Search:</strong> {filters.search}</div>}
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '8.5px' }}>
                        {renderBatchColGroup()}
                        <thead>
                            <tr>
                                <th style={{ ...thStyle, textAlign: 'center' }}>#</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Pin No</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Admission No</th>
                                <th style={{ ...thStyle, textAlign: 'left' }}>Student Name</th>
                                <th style={{ ...thStyle, textAlign: 'left' }}>Course / Branch</th>
                                {resolvedBatchYears.map(yr => (
                                    <th key={yr} style={{ ...thStyle, textAlign: 'center' }}>
                                        Year {yr} Due
                                    </th>
                                ))}
                                <th style={{ ...thStyle, textAlign: 'center', backgroundColor: activeDueCellBg }}>Overall Due</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedStudents.map((st, idx) => (
                                <React.Fragment key={st.admission_number || idx}>
                                    <tr>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>{idx + 1}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace' }}>{st.pin_no || '-'}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace' }}>{st.admission_number || '-'}</td>
                                        <td style={{ ...tdStyle, fontWeight: 'bold', overflow: 'hidden', wordBreak: 'break-word' }} title={st.student_name}>
                                            {st.student_name}
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {[st.course, st.branch].filter(Boolean).join(' - ') || '-'}
                                        </td>
                                        {resolvedBatchYears.map(yr => {
                                            const yVal = Number(st.yearDues?.[yr] || 0);
                                            return (
                                                <td key={yr} style={{ ...tdStyle, textAlign: 'center', fontWeight: yVal > 0 ? 'bold' : 'normal' }}>
                                                    ₹{fmtAmount(yVal)}
                                                </td>
                                            );
                                        })}
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', backgroundColor: activeDueCellBg }}>
                                            ₹{fmtAmount(st.dueAmount)}
                                        </td>
                                    </tr>
                                    {includeDetails && (
                                        <tr>
                                            <td colSpan={batchColCount} style={{ padding: '4px 8px 6px 8px', border: '1px solid #000', backgroundColor: '#fff' }}>
                                                {renderBatchBreakdownTable(st, resolvedBatchYears)}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}

                            {/* Grand total row */}
                            <tr style={{ fontWeight: 'bold' }}>
                                <td colSpan={5} style={{ ...tdStyle, textAlign: 'left', fontWeight: 'bold', borderTop: '2px solid #000' }}>
                                    GRAND TOTAL (All Students: {totalStudents})
                                </td>
                                {resolvedBatchYears.map(yr => (
                                    <td key={yr} style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', borderTop: '2px solid #000' }}>
                                        ₹{fmtAmount(grandBatchTotals[yr])}
                                    </td>
                                ))}
                                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', borderTop: '2px solid #000', backgroundColor: activeDueCellBg }}>
                                    ₹{fmtAmount(grandBatchDueTotal)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // ==========================================
    // 3. OVERALL REPORT - ACADEMIC YEAR MODE
    // ==========================================
    const totalStudents = reportData.length;
    const grandFee = summary.totalFee || reportData.reduce((sum, s) => sum + Number(s.totalFee || 0), 0);
    const grandConcession = summary.totalConcession || reportData.reduce((sum, s) => sum + Number(s.concessionAmount || 0), 0);
    const grandCollected = summary.totalCollected || reportData.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0);
    const grandTermDues = Array.from({ length: maxTerms }).map((_, i) =>
        reportData.reduce((sum, s) => sum + Number(s.termDues?.[i] || 0), 0)
    );
    const grandPreviousDue = summary.totalPreviousDue || reportData.reduce((sum, s) => sum + Number(s.previousDue || 0), 0);
    const grandActiveDue = summary.totalActiveDue || reportData.reduce((sum, s) => sum + Number(s.activeDue || 0), 0);
    const grandDueAmount = summary.totalDue || reportData.reduce((sum, s) => sum + Number(s.dueAmount || 0), 0);

    const isYearFiltered = Boolean(filters.year && String(filters.year).trim() !== '');

    let yearGroups = {};
    if (!isYearFiltered) {
        reportData.forEach((st) => {
            const yr = st.current_year || st.year || st.studentYear || '1';
            const yrKey = `Year ${yr}`;
            if (!yearGroups[yrKey]) yearGroups[yrKey] = [];
            yearGroups[yrKey].push(st);
        });
    } else {
        yearGroups[`Year ${filters.year}`] = [...reportData];
    }

    Object.keys(yearGroups).forEach((yrKey) => {
        yearGroups[yrKey].sort((a, b) => {
            const pinA = String(a.pin_no || a.admission_number || '').trim();
            const pinB = String(b.pin_no || b.admission_number || '').trim();
            return pinA.localeCompare(pinB, undefined, { numeric: true, sensitivity: 'base' });
        });
    });

    const sortedYearKeys = Object.keys(yearGroups).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
    });

    const printedOn = formatPrintedOn();

    return (
        <div ref={ref} style={{ fontFamily: 'Arial, sans-serif', color: '#000', backgroundColor: '#fff' }}>
            <style type="text/css">
                {`
                    @page { size: A4 landscape; margin: 6mm; }
                    @media print {
                        @page { size: A4 landscape; margin: 6mm; }
                        body { background-color: #fff; }
                        .page-break { page-break-before: always; break-before: page; }
                    }
                `}
            </style>

            {sortedYearKeys.map((yearKey, yIdx) => {
                const groupStudents = yearGroups[yearKey];
                const yFee = groupStudents.reduce((sum, s) => sum + Number(s.totalFee || 0), 0);
                const yConcession = groupStudents.reduce((sum, s) => sum + Number(s.concessionAmount || 0), 0);
                const yPaid = groupStudents.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0);
                const yTermDues = Array.from({ length: maxTerms }).map((_, i) =>
                    groupStudents.reduce((sum, s) => sum + Number(s.termDues?.[i] || 0), 0)
                );
                const yPreviousDue = groupStudents.reduce((sum, s) => sum + Number(s.previousDue || 0), 0);
                const yActiveDue = groupStudents.reduce((sum, s) => sum + Number(s.activeDue || 0), 0);
                const yDueAmount = groupStudents.reduce((sum, s) => sum + Number(s.dueAmount || 0), 0);
                const isLastYear = yIdx === sortedYearKeys.length - 1;
                const showYearSubTotal = sortedYearKeys.length > 1;
                const activeDueCellBg = '#ececec';

                return (
                    <div
                        key={yIdx}
                        className={yIdx > 0 ? 'page-break' : ''}
                        style={{
                            padding: '16px 18px',
                            pageBreakBefore: yIdx > 0 ? 'always' : 'auto',
                            breakBefore: yIdx > 0 ? 'page' : 'auto'
                        }}
                    >
                        <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '6px', marginBottom: '8px' }}>
                            <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>Pydah Group of Colleges</h1>
                            <p style={{ margin: '3px 0', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                                ACADEMIC DUE REPORT AS ON DATE : {printedOn}
                                {!isYearFiltered ? ` — ${yearKey.toUpperCase()}` : ''}
                            </p>
                        </div>

                        <div style={{ border: '1px solid #000', padding: '5px 8px', marginBottom: '8px', fontSize: '9px', display: 'flex', flexWrap: 'wrap', gap: '3px 14px', backgroundColor: '#fff' }}>
                            {filters.college && <div><strong>College:</strong> {filters.college}</div>}
                            {filters.course && <div><strong>Course:</strong> {filters.course}</div>}
                            {filters.branch && <div><strong>Branch:</strong> {filters.branch}</div>}
                            {filters.year ? (
                                <div><strong>Year:</strong> Year {filters.year}</div>
                            ) : (
                                <div><strong>Year:</strong> {yearKey}</div>
                            )}
                            {filters.quota && <div><strong>Quota:</strong> {filters.quota}</div>}
                            {filters.batch && <div><strong>Academic Year / Batch:</strong> {filters.batch}</div>}
                            {filters.studentStatus && <div><strong>Status:</strong> {filters.studentStatus}</div>}
                            {filters.scholarshipMode && <div><strong>Scholarship:</strong> {filters.scholarshipMode}</div>}
                            {filters.feeHeads && <div><strong>Fee Heads:</strong> {filters.feeHeads}</div>}
                            {filters.search && <div><strong>Search:</strong> {filters.search}</div>}
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '8.5px' }}>
                            {renderColGroup()}
                            <thead>
                                <tr>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>#</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Pin No</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Admission No</th>
                                    <th style={{ ...thStyle, textAlign: 'left' }}>Student Name</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Total Fee</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Concession</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Paid</th>
                                    {Array.from({ length: maxTerms }).map((_, i) => (
                                        <th key={i} style={{ ...thStyle, textAlign: 'center' }}>
                                            <div>T{i + 1} Due</div>
                                            {termHeaderDates[i] && (
                                                <div style={{ fontSize: '7px', fontWeight: 'normal', color: '#000', marginTop: '1px' }}>
                                                    {termHeaderDates[i]}
                                                </div>
                                            )}
                                        </th>
                                    ))}
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Previous Due</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Active Due</th>
                                    <th style={{ ...thStyle, textAlign: 'center', backgroundColor: activeDueCellBg }}>Total Due</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupStudents.map((st, idx) => {
                                    const termDues = st.termDues || [];
                                    return (
                                        <React.Fragment key={idx}>
                                            <tr>
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>{idx + 1}</td>
                                                <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace' }}>{st.pin_no || '-'}</td>
                                                <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace' }}>{st.admission_number || '-'}</td>
                                                <td style={{ ...tdStyle, fontWeight: 'bold', overflow: 'hidden', wordBreak: 'break-word' }} title={st.student_name}>
                                                    {st.student_name}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>₹{fmtAmount(st.totalFee)}</td>
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>₹{fmtAmount(st.concessionAmount)}</td>
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>₹{fmtAmount(st.paidAmount)}</td>
                                                {Array.from({ length: maxTerms }).map((_, i) => {
                                                    const termDue = Number(termDues[i] || 0);
                                                    return (
                                                        <td
                                                            key={i}
                                                            style={{
                                                                ...tdStyle,
                                                                textAlign: 'center',
                                                                fontWeight: termDue > 0 ? 'bold' : 'normal'
                                                            }}
                                                        >
                                                            ₹{fmtAmount(termDue)}
                                                        </td>
                                                    );
                                                })}
                                                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: (st.previousDue || 0) > 0 ? 'bold' : 'normal' }}>
                                                    ₹{fmtAmount(st.previousDue)}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>
                                                    ₹{fmtAmount(st.activeDue)}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', backgroundColor: activeDueCellBg }}>
                                                    ₹{fmtAmount(st.dueAmount)}
                                                </td>
                                            </tr>
                                            {includeDetails && (
                                                <tr>
                                                    <td colSpan={totalColCount} style={{ padding: '4px 8px 6px 8px', border: '1px solid #000', backgroundColor: '#fff' }}>
                                                        {renderBreakdownTable(st, maxTerms)}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}

                                {/* Year sub-total only when multiple year pages (avoids duplicate with grand total) */}
                                {showYearSubTotal && (
                                    <tr style={{ fontWeight: 'bold' }}>
                                        <td colSpan={baseColCount} style={{ ...tdStyle, textAlign: 'left', fontWeight: 'bold' }}>
                                            {yearKey} Sub-Total ({groupStudents.length} Students)
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>₹{fmtAmount(yFee)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>₹{fmtAmount(yConcession)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>₹{fmtAmount(yPaid)}</td>
                                        {yTermDues.map((amt, i) => (
                                            <td key={i} style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>
                                                ₹{fmtAmount(amt)}
                                            </td>
                                        ))}
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>₹{fmtAmount(yPreviousDue)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>₹{fmtAmount(yActiveDue)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', backgroundColor: activeDueCellBg }}>
                                            ₹{fmtAmount(yDueAmount)}
                                        </td>
                                    </tr>
                                )}

                                {/* Grand total only (same table so columns align) */}
                                {isLastYear && (
                                    <tr style={{ fontWeight: 'bold' }}>
                                        <td colSpan={baseColCount} style={{ ...tdStyle, textAlign: 'left', fontWeight: 'bold', borderTop: '2px solid #000' }}>
                                            GRAND TOTAL (All Students: {totalStudents})
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', borderTop: '2px solid #000' }}>₹{fmtAmount(grandFee)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', borderTop: '2px solid #000' }}>₹{fmtAmount(grandConcession)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', borderTop: '2px solid #000' }}>₹{fmtAmount(grandCollected)}</td>
                                        {grandTermDues.map((amt, i) => (
                                            <td key={i} style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', borderTop: '2px solid #000' }}>
                                                ₹{fmtAmount(amt)}
                                            </td>
                                        ))}
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', borderTop: '2px solid #000' }}>₹{fmtAmount(grandPreviousDue)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', borderTop: '2px solid #000' }}>₹{fmtAmount(grandActiveDue)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', borderTop: '2px solid #000', backgroundColor: activeDueCellBg }}>
                                            ₹{fmtAmount(grandDueAmount)}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                );
            })}
        </div>
    );
});

DueReportPrintTemplate.displayName = 'DueReportPrintTemplate';

export default DueReportPrintTemplate;
