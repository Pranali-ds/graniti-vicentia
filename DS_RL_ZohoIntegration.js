/**
 * @NApiVersion 2.x
 * @NScriptType Restlet
 */
define([
    'N/record',
    'N/log'
], function (record, log) {

    function post(context) {

        log.audit('Payload Received', JSON.stringify(context));

        try {
            /* =============================
               1. Validate Inputs
               ============================= */
            var expenseId = context.expense_id;
            var expenseDate = context.date;

            if (!expenseId) {
                throw 'expense_id is missing in payload';
            }

            if (!expenseDate) {
                throw 'date is missing in payload';
            }

            /* =============================
               2. Convert Date
               ============================= */
            var nsDate = toNetSuiteDate(expenseDate);

            /* =============================
               3. Create Expense Report
               ============================= */
            var expReport = record.create({
                type: record.Type.EXPENSE_REPORT,
                isDynamic: true
            });

            // Transaction Date
            expReport.setValue({
                fieldId: 'trandate',
                value: nsDate
            });

            // Transaction ID (Document Number)
            expReport.setValue({
                fieldId: 'tranid',
                value: expenseId
            });

            var expenseReportId = expReport.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            return {
                status: 'SUCCESS',
                expenseReportId: expenseReportId,
                trandate: nsDate,
                tranid: expenseId
            };

        } catch (e) {
            log.error('Restlet Error', e);
            return {
                status: 'FAILED',
                error: e.toString()
            };
        }
    }

    /* =============================
       Helper Function
       ============================= */
    function toNetSuiteDate(dateStr) {
        // YYYY-MM-DD → MM/DD/YYYY
        var parts = dateStr.split('-');
        if (parts.length !== 3) {
            throw 'Invalid date format: ' + dateStr;
        }

        var yyyy = parts[0];
        var mm = parts[1];
        var dd = parts[2];

        return new Date(mm + '/' + dd + '/' + yyyy);
    }

    return {
        post: post
    };
});
