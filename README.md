# New Selectize Plugin Update for Saltcorn
This update introduces enhanced functionality to the Selectize plugin in Saltcorn, focusing on customizable AJAX responses and optimized data fetching. It allows users to format dropdown labels dynamically (e.g., combining fields like name and CNPJ) and limit fetched columns for better performance, without altering the database. The backend modifications ensure the API supports these features securely.

## Key Changes

- **AJAX Response Formatting:** Customize how options appear in the dropdown using placeholders like {nome} - {cnpj}.
- **Column Limiting:** Specify fields to fetch (e.g., "id,nome,cnpj") to reduce data transfer.
- **Multisearch Support:** Search across multiple fields (e.g., partial matches in name or CNPJ) for more flexible queries.
- **Bug Fixes:** Resolved syntax issues, dynamic "where" filtering, and bidirectional autofill (removed in favor of formatting).

These improvements make Selectize more efficient for large datasets and complex forms, with no breaking changes to existing setups.

## Installation and Upgrade

- Reinstall the plugin in Saltcorn via the admin interface.
- Apply backend changes to packages/server/routes/api.js as detailed in the README below.
- Test with a key field: Enable AJAX, set "Columns to fetch" and "AJAX response format".

For full details on backend integration, see the README file content below.

# Comprehensive Survey on Selectize Plugin Update and Backend Integration
This survey provides an in-depth overview of the Selectize plugin update for Saltcorn, including rationale, code changes, backend modifications, testing guidelines, and potential extensions. The update addresses user feedback on AJAX customization, performance optimization, and search flexibility, making it a significant enhancement for form-based applications. It removes deprecated autofill features in favor of response formatting, aligning with modern UX patterns in dropdowns.

## Update Rationale and Features
The original Selectize plugin limited AJAX responses to a single summary field, leading to issues like incomplete data display or inefficient fetches. This version introduces dynamic formatting (e.g., {nome} - {cnpj}) using string replacement in JavaScript, allowing rich labels without DB changes. Column limiting reduces payload size, crucial for mobile or high-latency environments. Multisearch enables OR-based filtering across fields, solving the "search by name but param is cnpj" problem by dynamically building queries.
Key enhancements:

- **Response Formatting:** Uses regex replacement for placeholders, supporting any fetched column.
- **Column Fetching:** Integrates with backend colunas param for selective SELECT.
- **Multisearch:** Backend OR clauses for partial matches, with frontend param passing.
- I was unable to implement autocomplete (autofill) because there were several bugs.

These changes improve usability without requiring schema modifications, though for very large tables, consider indexing search fields.


# Selectize Plugin for Saltcorn - Update Guide

This README details backend modifications to `packages/server/routes/api.js` for the new Selectize version, enabling column limiting, multisearch, and dynamic response formatting.

## Prerequisites
- Saltcorn version 1.0.0 or higher.
- Selectize plugin installed and updated with the new index.js.

## Step-by-Step Backend Changes
1. **Open api.js**: Navigate to `packages/server/routes/api.js`.

2. **Add Multisearch Logic**: In the GET /:tableName/ handler, change for:
```javascript
router.get(
"/:tableName/",
//passport.authenticate("api-bearer", { session: false }),
error_catcher(async (req, res, next) => {
    let { tableName } = req.params;
    const {
    fields: queryFields,
    columns,  // Alias for backward compatibility if needed
    versioncount,
    limit,
    offset,
    sortBy,
    sortDesc,
    approximate,
    dereference,
    tabulator_pagination_format,
    ...req_query0
    } = req.query;

    let req_query = req_query0;
    let tabulator_size, tabulator_page, tabulator_sort, tabulator_dir;
    if (tabulator_pagination_format) {
    const { page, size, sort, ...rq } = req_query0;
    req_query = rq;
    tabulator_page = page;
    tabulator_size = size;
    tabulator_sort = sort?.[0]?.field;
    tabulator_dir = sort?.[0]?.dir;
    }
    if (typeof limit !== "undefined")
    if (isNaN(limit) || !validateNumberMin(limit, 1)) {
        getState().log(3, `API get ${tableName} Invalid limit parameter`);
        return res.status(400).send({ error: "Invalid limit parameter" });
    }
    if (typeof offset !== "undefined")
    if (isNaN(offset) || !validateNumberMin(offset, 0)) {
        getState().log(3, `API get ${tableName} Invalid offset parameter`);
        return res.status(400).send({ error: "Invalid offset parameter" });
    }
    const strictIntId = strictParseInt(tableName);
    let table = Table.findOne(
    strictIntId ? { id: strictParseInt(tableName) } : { name: tableName }
    );
    if (strictIntId && !table) table = Table.findOne({ name: tableName });
    if (!table) {
    getState().log(3, `API get ${tableName} table not found`);
    getState().log(
        6,
        `API get failure additonal info: URL=${req.originalUrl}${
        getState().getConfig("log_ip_address", false) ? ` IP=${req.ip}` : ""
        }`
    );
    res.status(404).json({ error: req.__("Not found") });
    return;
    }
    const orderByField =
    (sortBy || tabulator_sort) && table.getField(sortBy || tabulator_sort);

    const use_limit = tabulator_pagination_format
    ? +tabulator_size
    : limit && +limit;
    const use_offset = tabulator_pagination_format
    ? +tabulator_size * (+tabulator_page - 1)
    : offset && +offset;

    await passport.authenticate(
    ["api-bearer", "jwt"],
    { session: false },
    async function (err, user, info) {
        if (accessAllowedRead(req, user, table, true)) {
        let rows;
        if (versioncount === "on") {
            const joinOpts = {
            forUser: req.user || user || { role_id: 100 },
            forPublic: !(req.user || user),
            limit: use_limit,
            offset: use_offset,
            orderDesc:
                (sortDesc && sortDesc !== "false") || tabulator_dir == "desc",
            orderBy: orderByField?.name || "id",
            aggregations: {
                _versions: {
                table: table.name + "__history",
                ref: table.pk_name,
                field: table.pk_name,
                aggregate: "count",
                },
            },
            };
            rows = await table.getJoinedRows(joinOpts);
        } else {
            const tbl_fields = table.getFields();
            readState(req_query, tbl_fields, req);
            const qstate = stateFieldsToWhere({
            fields: tbl_fields,
            approximate: !!approximate,
            state: req_query,
            table,
            prefix: "a.",
            });
            const joinFields = {};
            const derefs = Array.isArray(dereference)
            ? dereference
            : !dereference
                ? []
                : [dereference];
            derefs.forEach((f) => {
            const field = table.getField(f);
            if (field?.attributes?.summary_field)
                joinFields[`${f}_${field?.attributes?.summary_field}`] = {
                ref: f,
                target: field?.attributes?.summary_field,
                };
            });
            try {
            rows = await table.getJoinedRows({
                where: qstate,
                joinFields,
                limit: use_limit,
                offset: use_offset,
                orderDesc:
                (sortDesc && sortDesc !== "false") || tabulator_dir == "desc",
                orderBy: orderByField?.name || undefined,
                forPublic: !(req.user || user),
                forUser: req.user || user,
            });
            } catch (e) {
            console.error(e);
            res.json({ error: "API error" });
            return;
            }
        }

        // Process colunas for DB-level limiting
        let selectFields = tbl_fields.map(f => f.name);
        if (req.query.colunas && typeof req.query.colunas === 'string') {
        let requested = req.query.colunas.split(',').map(c => c.trim()).filter(Boolean);
        if (requested.length > 0 && requested.length <= 10) {
            const validFields = tbl_fields.map(f => f.name);
            requested = requested.filter(c => validFields.includes(c));
            if (requested.length > 0) {
            selectFields = requested;
            getState().log(5, `API GET ${table.name} limited to columns: ${selectFields.join(', ')}`);
            }
        }
        }

        const opts = {
        where: qstate,
        joinFields,
        limit: use_limit,
        offset: use_offset,
        orderDesc: (sortDesc && sortDesc !== "false") || tabulator_dir == "desc",
        orderBy: orderByField?.name || undefined,
        forPublic: !(req.user || user),
        forUser: req.user || user,
        fields: selectFields  // DB-level limiting here
        };

        if (versioncount === "on") {
        opts.aggregations = {
            _versions: {
            table: table.name + "__history",
            ref: table.pk_name,
            field: table.pk_name,
            aggregate: "count",
            },
        };
        rows = await table.getJoinedRows(opts);
        } else {
        rows = await table.getJoinedRows(opts);  // Use opts with fields
        }

        if (tabulator_pagination_format) {
            const count = await table.countRows();
            if (count === null)
            res.json({
                data: rows.map(limitFields(queryFields || columns)),
            });
            else
            res.json({
                last_page: Math.ceil(count / +tabulator_size),
                data: rows.map(limitFields(queryFields || columns)),
            });
        } else res.json({ success: rows.map(limitFields(queryFields || columns)) });
        } else {
        getState().log(3, `API get ${table.name} not authorized`);
        res.status(401).json({ error: req.__("Not authorized") });
        }
    }
    )(req, res, next);
})
);
