/**
 * @NApiVersion 2.x
 * @NScriptType Restlet
 */
define([
  'N/record',
  'N/search',
  'N/file',
  'N/https',
  'N/runtime'
], function (record, search, file, https, runtime) {

  /* =========================
     POST – Create Expense Report
     ========================= */
  function post(context) {
    try {

      // 1️⃣ Get Employee
      var employeeId = getEmployeeId(context.employee_email);
      if (!employeeId) {
        throw 'Employee not found for email: ' + context.employee_email;
      }

      // 2️⃣ Create Expense Report
      var expReport = record.create({
        type: record.Type.EXPENSE_REPORT,
        isDynamic: true
      });

      expReport.setValue({ fieldId: 'entity', value: employeeId });
      expReport.setValue({ fieldId: 'trandate', value: new Date(context.tran_date) });
      expReport.setValue({ fieldId: 'memo', value: context.memo || 'Zoho Expense Report' });

      // 3️⃣ Add Expense Lines
      context.expenses.forEach(function (line) {

        expReport.selectNewLine({ sublistId: 'expense' });

        expReport.setCurrentSublistValue({
          sublistId: 'expense',
          fieldId: 'category',
          value: getCategoryId(line.category)
        });

        expReport.setCurrentSublistValue({
          sublistId: 'expense',
          fieldId: 'amount',
          value: line.amount
        });

        expReport.setCurrentSublistValue({
          sublistId: 'expense',
          fieldId: 'memo',
          value: line.description || line.merchant
        });

        expReport.setCurrentSublistValue({
          sublistId: 'expense',
          fieldId: 'reimbursable',
          value: line.reimbursable === true
        });

        // Attach Receipt (Optional)
        if (line.receipt_url) {
          var fileId = downloadAndSaveFile(line.receipt_url);
          if (fileId) {
            expReport.setCurrentSublistValue({
              sublistId: 'expense',
              fieldId: 'receipt',
              value: fileId
            });
          }
        }

        expReport.commitLine({ sublistId: 'expense' });
      });

      // 4️⃣ Save
      var expenseReportId = expReport.save();

      return {
        success: true,
        expenseReportId: expenseReportId
      };

    } catch (e) {
      log.error('RESTlet Error', e);
      return {
        success: false,
        message: e.toString()
      };
    }
  }

  /* =========================
     Helper: Get Employee
     ========================= */
  function getEmployeeId(email) {
    var empSearch = search.create({
      type: search.Type.EMPLOYEE,
      filters: [['email', 'is', email]],
      columns: ['internalid']
    });

    var result = empSearch.run().getRange({ start: 0, end: 1 });
    return result.length ? result[0].getValue('internalid') : null;
  }

  /* =========================
     Helper: Get Expense Category
     ========================= */
  function getCategoryId(categoryName) {
    var catSearch = search.create({
      type: 'expensecategory',
      filters: [['name', 'is', categoryName]],
      columns: ['internalid']
    });

    var result = catSearch.run().getRange({ start: 0, end: 1 });
    if (!result.length) {
      throw 'Expense Category not found: ' + categoryName;
    }
    return result[0].getValue('internalid');
  }

  /* =========================
     Helper: Download Receipt
     ========================= */
  function downloadAndSaveFile(url) {
    try {
      var response = https.get({ url: url });
      if (response.code !== 200) return null;

      var receiptFile = file.create({
        name: 'zoho_receipt_' + Date.now() + '.jpg',
        fileType: file.Type.JPGIMAGE,
        contents: response.body,
        folder: -15 // SuiteScripts folder (change if needed)
      });

      return receiptFile.save();
    } catch (e) {
      log.error('Receipt Download Failed', e);
      return null;
    }
  }

  return {
    post: post
  };
});
