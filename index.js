const {
  option,
  a,
  h5,
  span,
  text_attr,
  script,
  input,
  style,
  domReady,
} = require("@saltcorn/markup/tags");
const tags = require("@saltcorn/markup/tags");
const { select_options } = require("@saltcorn/markup/helpers");
const { features, getState } = require("@saltcorn/data/db/state");
const Workflow = require("@saltcorn/data/models/workflow");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
const Form = require("@saltcorn/data/models/form");

const bsBgColor = () => {
  const state = getState();
  if (state.plugin_cfgs) {
    let anyBsThemeCfg = state.plugin_cfgs["any-bootstrap-theme"];
    if (!anyBsThemeCfg)
      anyBsThemeCfg = state.plugin_cfgs["@saltcorn/any-bootstrap-theme"];
    if (anyBsThemeCfg?.backgroundColorDark)
      return anyBsThemeCfg.backgroundColorDark;
  }
  return "";
};

const selectize = {
  /** @type {string} */
  type: "Key",
  /** @type {boolean} */
  isEdit: true,
  blockDisplay: true,

  /**
   * @type {object[]}
   */
  fill_options_restrict(field, v) {
    if (field?.attributes?.ajax) {
      const pk = Table.findOne(field.reftable_name)?.pk_name;
      if (pk) return { [pk]: v || null };
    }
  },
  
  configFields: () => [
    {
      name: "neutral_label",
      label: "Neutral label",
      type: "String",
    },
    {
      name: "where",
      label: "Where",
      type: "String",
    },
    {
      name: "ajax_response_format",
      label: "AJAX response format",
      type: "String",
      sublabel: "Format the dropdown label. Ex: {name} - {cnpj}",
    },
    {
      name: "ajax",
      label: "Ajax fetch options",
      type: "Bool",
    },
    {
      name: "placeholder",
      label: "Placeholder",
      type: "String",
    },
    {
      name: "allow_clear",
      label: "Allow clear",
      type: "Bool",
    },
    {
      name: "maxHeight",
      label: "max-height px",
      type: "Integer",
    },
    {
      name: "force_required",
      label: "Force required",
      sublabel:
        "User must select a value, even if the table field is not required",
      type: "Bool",
    },
    {
      name: "label_formula",
      label: "Label formula",
      type: "String",
      class: "validate-expression",
      sublabel: "Uses summary field if blank",
    },
    {
      name: "columns_to_fetch",
      label: "Columns to fetch",
      type: "String",
      sublabel: "Column names to return. Ex: id, name, email",
    },
  ],

  /**
   * @param {*} nm
   * @param {*} v
   * @param {*} attrs
   * @param {*} cls
   * @param {*} reqd
   * @param {*} field
   * @returns {object}
   */
  run: (nm, v, attrs, cls, reqd, field) => {
    if (attrs.disabled)
      return (
        input({
          class: `${cls} ${field.class || ""}`,
          "data-fieldname": field.form_name,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          readonly: true,
          placeholder: v || field.label,
        }) + span({ class: "ml-m1" }, "v")
      );
    
    let opts = [];
    if (!attrs.ajax)
      opts = select_options(
        v,
        field,
        (attrs || {}).force_required,
        (attrs || {}).neutral_label
      );
    else
      opts = select_options(
        v,
        {
          ...field,
          options: (field.options || []).filter(
            (o) => o.value == v || o.value === ""
          ),
        },
        (attrs || {}).force_required,
        (attrs || {}).neutral_label
      );
    
    if (attrs.isFilter && field.required)
      opts = `<option value="">${attrs?.neutral_label || ""}</option>` + opts;
    
    const noChange = attrs.isFilter && attrs.dynamic_where;
    
    return (
      tags.select(
        {
          class: `form-control scfilter ${cls} ${
            field.class || ""
          } selectize-nm-${text_attr(nm)}`,
          "data-fieldname": field.form_name,
          name: text_attr(nm),
          onChange: !noChange && attrs.onChange,
          id: `input${text_attr(nm)}`,
          ...(attrs?.dynamic_where
            ? {
                "data-selected": v,
                "data-fetch-options": encodeURIComponent(
                  JSON.stringify(attrs?.dynamic_where)
                ),
              }
            : {}),
        },
        opts
      ) +
      script(
        domReady(
          `
const addFiveToColor = (hexColor) => {
  const decimalColor = parseInt(hexColor.replace("#", ""), 16);
  let red = (decimalColor >> 16) & 0xff;
  let green = (decimalColor >> 8) & 0xff;
  let blue = decimalColor & 0xff;
  red = Math.min(255, red + 5);
  green = Math.min(255, green + 5);
  blue = Math.min(255, blue + 5);
  return \`#\${((red << 16) | (green << 8) | blue)
    .toString(16)
    .padStart(6, "0")}\`;
}

const getDarkStyle = (bg) => {
  return \`
  .selectize-input {
    background-color: \${bg} !important;
    color: #fff !important;
  }

  .selectize-control {
    background-color: \${bg} !important;
    color: #fff !important;
  }

  .selectize-dropdown  {
    background-color: \${bg} !important;
    color: #fff !important;
  }
  .selectize-dropdown-content .option.active {
    background-color: \${addFiveToColor(bg)} !important;
    color: #fff !important;
  }
\`;
};

const darkBg = window._sc_lightmode==="dark" ? 
  (getComputedStyle(document.body).getPropertyValue('--tblr-body-bg').trim() || 
    "${bsBgColor()}") : null; 
if (darkBg) {
  const style = document.createElement('style');
  style.textContent = getDarkStyle(darkBg);
  document.head.appendChild(style);
}
const isWeb = typeof parent.window.saltcorn?.markup === "undefined";
const hasCapacitor = typeof parent.window.saltcorn?.mobileApp !== "undefined";
$('#input${text_attr(nm)}').selectize({
            ${
              attrs?.isFilter || field.required
                ? `plugins: ["remove_button"],`
                : ""
            }
            ${attrs.placeholder ? `placeholder: "${attrs.placeholder}",` : ""}
            ${
              attrs?.ajax
                ? `load: async function(query, callback) {
if (!query.length || query.length<2) return callback();
const url = '/api/${field.reftable_name}?${
                    field.attributes.summary_field
                  }='+query+'&approximate=true' + ( "${attrs.columns_to_fetch ? '&colunas=' + encodeURIComponent(attrs.columns_to_fetch) : ''}" );
  if (isWeb) {
   $.ajax({
    url: url,
    type: 'GET',
    dataType: 'json',
    error: function(err) { console.log(err); },
  success: function(data) {
    if(!data || !data.success) return [];
    const formatLabel = (item) => {
      let format = "${attrs.ajax_response_format || ''}";
      if (!format) return item.${field.attributes.summary_field};
      return format.replace(/{(\\w+)}/g, (match, col) => item[col] || '');
    };
    const options = data.success.map(item=>({text: formatLabel(item), value: item.id, ...item }))
    callback(options)
    }
              })
    }
    else if (hasCapacitor) {
      const response = await parent.window.saltcorn.mobileApp.api.apiCall({
        method: 'GET',
        path: url,
        responseType: "json",
      });
      const data = response.data;
      if(!data || !data.success) callback([]);
      else {
        const formatLabel = (item) => {
          let format = "${attrs.ajax_response_format || ''}";
          if (!format) return item.${field.attributes.summary_field};
          return format.replace(/{(\\w+)}/g, (match, col) => item[col] || '');
        };
        const options = data.success.map(item=>({text: formatLabel(item), value: item.id, ...item }));
        callback(options)
      }
    }
    else {
      console.error("No API available")
    }
            }`
                : ""
            }
          
          });         
          document.getElementById('input${text_attr(
            nm
          )}').addEventListener('RefreshSelectOptions', (e) => { }, false);
        `
        )
      ) +
      (attrs?.maxHeight
        ? style(
            `.selectize-dropdown.selectize-nm-${text_attr(
              nm
            )} .selectize-dropdown-content {
            max-height: ${attrs?.maxHeight}px;            
          } `
          )
        : "")
    );
  },
};

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "everything",
        form: async (context) => {
          return new Form({
            fields: [
              {
                name: "everything",
                label: "Selectize everything",
                sublabel: "Apply selectize everywhere possible",
                type: "Bool",
              },
            ],
          });
        },
      },
    ],
  });

const search_or_create_selectize = {
  /** @type {string} */
  type: "Key",
  /** @type {boolean} */
  isEdit: true,
  blockDisplay: true,
  description:
    "Select from dropdown, or give user the option of creating a new relation in a popup",

  /**
   * @param {object} field
   * @returns {Promise<object[]>}
   */
  configFields: async (field) => {
    const reftable = Table.findOne({ name: field.reftable_name });
    if (!reftable) return [];
    const views = await View.find({ table_id: reftable.id }, { cached: true });
    return [
      {
        name: "viewname",
        label: "View to create",
        input_type: "select",
        form_name: field.form_name,
        options: views.map((v) => v.name),
      },
      {
        name: "label",
        label: "Label on link to create",
        type: "String",
      },
      {
        name: "where",
        label: "Where",
        type: "String",
      },
      {
        name: "ajax_response_format",
        label: "AJAX response format",
        type: "String",
        sublabel: "Format the dropdown label. Ex: {name} - {cnpj}",
      },
      {
        name: "placeholder",
        label: "Placeholder",
        type: "String",
      },
      {
        name: "columns_to_fetch",
        label: "Columns to fetch",
        type: "String",
        sublabel: "Column names to return. Ex: id, name, email",
      },
      {
        name: "label_formula",
        label: "Option label formula",
        type: "String",
        class: "validate-expression",
        sublabel: "Uses summary field if blank",
      },
    ];
  },

  /**
   * @param {*} nm
   * @param {*} v
   * @param {*} attrs
   * @param {*} cls
   * @param {*} reqd
   * @param {*} field
   * @returns {object}
   */
  run: (nm0, v, attrs, cls, reqd, field) => {
    const rndid = Math.floor(Math.random() * 16777215).toString(16);
    const nm = nm0 + rndid;
    
    return (
      tags.select(
        {
          class: `form-control form-select ${cls} ${field.class || ""}`,
          "data-fieldname": field.form_name,
          name: text_attr(nm0),
          id: `input${nm}`,
          disabled: attrs.disabled,
          readonly: attrs.readonly,
          onChange: attrs.onChange,
          autocomplete: "off",
          ...(attrs?.dynamic_where
            ? {
                "data-selected": v,
                "data-fetch-options": encodeURIComponent(
                  JSON.stringify(attrs?.dynamic_where)
                ),
              }
            : {}),
        },
        select_options(v, field)
      ) +
      a(
        {
          onclick: `ajax_modal('/view/${attrs.viewname}',{submitReload: false,onClose: soc_process_${nm}(this)})`,
          href: `javascript:void(0)`,
        },
        attrs.label || "Or create new"
      ) +
      script(
        domReady(
          `
const addFiveToColor = (hexColor) => {
  const decimalColor = parseInt(hexColor.replace("#", ""), 16);
  let red = (decimalColor >> 16) & 0xff;
  let green = (decimalColor >> 8) & 0xff;
  let blue = decimalColor & 0xff;
  red = Math.min(255, red + 5);
  green = Math.min(255, green + 5);
  blue = Math.min(255, blue + 5);
  return \`#\${((red << 16) | (green << 8) | blue)
    .toString(16)
    .padStart(6, "0")}\`;
}

const getDarkStyle = (bg) => {
  return \`
  .selectize-input {
    background-color: \${bg} !important;
    color: #fff !important;
  }

  .selectize-control {
    background-color: \${bg} !important;
    color: #fff !important;
  }

  .selectize-dropdown  {
    background-color: \${bg} !important;
    color: #fff !important;
  }
  .selectize-dropdown-content .option.active {
    background-color: \${addFiveToColor(bg)} !important;
    color: #fff !important;
  }
\`;
};

const darkBg = window._sc_lightmode==="dark" ? 
  (getComputedStyle(document.body).getPropertyValue('--tblr-body-bg').trim() || 
    "${bsBgColor()}") : null; 
if (darkBg) {
  const style = document.createElement('style');
  style.textContent = getDarkStyle(darkBg);
  document.head.appendChild(style);
}

$('#input${nm}').selectize({
  plugins: ["remove_button"],
  ${attrs.placeholder ? `placeholder: "${attrs.placeholder}",` : ""}
});         
document.getElementById('input${nm}').addEventListener('RefreshSelectOptions', (e) => { }, false);

window.soc_process_${nm} = (elem) => ()=> {
  const url = '/api/${field.reftable_name}' + ( "${attrs.columns_to_fetch ? '?colunas=' + encodeURIComponent(attrs.columns_to_fetch) : ''}" );
  $.ajax(url, {
    success: function (res, textStatus, request) {
      const dataOptions=[]
      const formatLabel = (item) => {
        let format = "${attrs.ajax_response_format || ''}";
        if (!format) return item.${attrs.summary_field || field.attributes.summary_field || 'id'};
        return format.replace(/{(\\w+)}/g, (match, col) => item[col] || '');
      };
      res.success.forEach(x=>{
        dataOptions.push({text: formatLabel(x), value:x.id, ...x })
      })
      ${field.required ? "" : `dataOptions.push({text: "", value: ""})`}
      dataOptions.sort((a, b) =>
        (a.text?.toLowerCase?.() || a.text) >
        (b.text?.toLowerCase?.() || b.text)
          ? 1
          : -1
      );
      const e = $('#input${nm}')
      e.selectize()[0].selectize.clearOptions(true);
      e.selectize()[0].selectize.addOption(dataOptions);
      e.selectize()[0].selectize.setValue(res.success[res.success.length-1].id);
    }
  })
}`
        )
      )
    );
  },
};

const fieldviews = () => ({ search_or_create_selectize, selectize });

module.exports = {
  sc_plugin_api_version: 1,
  fieldviews,
  configuration_workflow,
  plugin_name: "selectize",
  headers: ({ everything }) => [
    {
      script: `/plugins/public/selectize@${
        require("./package.json").version
      }/selectize.min.js`,
    },
    {
      css: `/plugins/public/selectize@${
        require("./package.json").version
      }/selectize.bootstrap5.css`,
    },
    ...(everything
      ? [
          {
            script: `/plugins/public/selectize${
              features?.version_plugin_serve_path
                ? "@" + require("./package.json").version
                : ""
            }/selectize_everything.js`,
          },
        ]
      : []),
  ],
  ready_for_mobile: true,
};