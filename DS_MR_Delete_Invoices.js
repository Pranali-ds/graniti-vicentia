/**
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */

define(['N/search', 'N/record', 'N/log'], function (search, record, log) {

    function getInputData() {
        return search.create({
            type: "transaction",
            filters: [
                ["internalid", "is", "66666"],
                "AND",
                ["mainline", "is", "T"]
            ],
            columns: [
                "internalid",
                "type",
                "tranid"
            ]
        });
    }

    function deleteRelatedTransactions(parentId) {
        var childSearch = search.create({
            type: "transaction",
            filters: [
                ["mainline", "is", "T"],
                "AND",
                [
                    ["appliedtotransaction.internalid", "anyof", parentId],
                    "OR",
                    ["createdfrom.internalid", "anyof", parentId]
                ]
            ],
            columns: ["internalid", "type", "tranid"]
        });

        childSearch.run().each(function (result) {
            var childId = result.getValue("internalid");
            var childType = result.getValue("type");
            var docNo = result.getValue("tranid");

            try {
                var deleted = record.delete({
                    type: childType,
                    id: childId
                });
                log.audit("Child Deleted", "Type: " + childType + " | ID: " + deleted + " | Doc#: " + docNo);
            } catch (e) {
                log.error("Child Delete Failed", "ID: " + childId + " | Type: " + childType + " | Error: " + e.message);
            }

            // Recursively delete further children
            deleteRelatedTransactions(childId);
            return true;
        });
    }

    function map(context) {
        var data = JSON.parse(context.value);

        var parentId = data.values.internalid.value;
        var parentType = data.values.type.value;
        var docNo = data.values.tranid;

        log.debug("Main Transaction", "Type: " + parentType + " | ID: " + parentId + " | Doc#: " + docNo);

        try {
            // Step 1: Delete linked / related transactions first
            deleteRelatedTransactions(parentId);

            // Step 2: Delete main transaction
            var deletedId = record.delete({
                type: parentType,
                id: parentId
            });

            log.audit("Main Transaction Deleted",
                "Type: " + parentType + " | ID: " + deletedId + " | Doc#: " + docNo
            );

        } catch (e) {
            log.error("Main Delete Failed", "Type: " + parentType + " | ID: " + parentId + " | Error: " + e.message);
            context.write({
                key: "0",
                value: docNo
            });
        }
    }

    return {
        getInputData: getInputData,
        map: map
    };
});
