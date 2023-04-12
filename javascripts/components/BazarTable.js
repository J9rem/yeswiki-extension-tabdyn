/*
 * This file is part of the YesWiki Extension tabdyn.
 *
 * Authors : see README.md file that was distributed with this source code.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import SpinnerLoader from '../../../bazar/presentation/javascripts/components/SpinnerLoader.js'

let componentName = 'BazarTable';
let isVueJS3 = (typeof Vue.createApp == "function");

let componentParams = {
    props: ['params','entries','ready','root','isadmin'],
    components: {SpinnerLoader},
    data: function() {
        return {
            cacheResolveReject: {},
            columns: [],
            dataTable: null,
            displayedEntries: {},
            fields: {},
            forms: {},
            isReady:{
                fields: false,
                params: false
            },
            templatesForRendering: {},
            uuid: null
        };
    },
    methods:{
        addRows(dataTable,columns,entries,currentusername,isadmin){
            const entriesToAdd = entries.filter((entry)=>!(entry.id_fiche in this.displayedEntries))
            let formattedDataList = []
            entriesToAdd.forEach((entry)=>{
                this.displayedEntries[entry.id_fiche] = entry
                let formattedData = {}
                columns.forEach((col)=>{
                    if (!(typeof col.data === 'string')){
                        formattedData[col.data] = ''
                    } else if (col.data === '==canDelete=='){
                        formattedData[col.data] = !this.$root.isExternalUrl(entry) && 
                            'owner' in entry &&
                            (isadmin || entry.owner == currentusername)
                    } else if (['==adminsbuttons=='].includes(col.data)) {
                        formattedData[col.data] = ''
                    } else if ('firstlevel' in col && typeof col.firstlevel === 'string' && col.firstlevel.length > 0){
                        formattedData[col.data] = (col.firstlevel in entry && col.data in entry[col.firstlevel]) ? entry[col.firstlevel][col.data] : ''
                    } else if ('checkboxfield' in col && typeof col.checkboxfield === 'string' && col.checkboxfield.length > 0){
                        formattedData[col.data] = (col.checkboxfield in entry && 'checkboxkey' in col && entry[col.checkboxfield].split(',').includes(col.checkboxkey)) ? 'X' : ''
                    } else {
                        formattedData[col.data] = col.data in entry ? entry[col.data] : ''
                    }
                })
                if (!('id_fiche' in formattedData)){
                    formattedData.id_fiche = entry.id_fiche || ''
                }
                if (!('url' in formattedData)){
                    formattedData.url = entry.url || ''
                }
                formattedDataList.push(formattedData)
            })
            dataTable.rows.add(formattedDataList)
        },
        arraysEqual(a, b) {
            if (a === b) return true
            if (a == null || b == null || !Array.isArray(a) || !Array.isArray(b)) return false
            if (a.length !== b.length) return false
    
            a.sort()
            b.sort()
            return a.every((val,idx)=>a[idx] !== b[idx])
        },
        deleteAllSelected(event){
            const uuid = this.getUuid()
            multiDeleteService.updateNbSelected(`MultiDeleteModal${uuid}`)
            const entriesIdsToRefreshDeleteToken = []
            $(`#${uuid}`).find('tr > td:first-child input.selectline[type=checkbox]:visible:checked').each(function (){
                const csrfToken = $(this).data('csrftoken')
                const itemId = $(this).data('itemid')
                if (typeof itemId === 'string' && itemId.length > 0 && (typeof csrfToken !== 'string' || csrfToken === 'to-be-defined')){
                    entriesIdsToRefreshDeleteToken.push({elem:$(this),itemId})
                }
            })
            if (entriesIdsToRefreshDeleteToken.length > 0){
                this.getCsrfDeleteTokens(entriesIdsToRefreshDeleteToken.map((e)=>e.itemId))
                    .then((tokens)=>{
                        entriesIdsToRefreshDeleteToken.forEach(({elem,itemId})=>{
                            $(elem).data('csrftoken',tokens[itemId] || 'error')
                        })
                    })
                    .catch(this.manageError)
            }
            // if something to do before showing modal (like get csrf token ?)
        },
        getAdminsButtons(entryId,entryTitle,entryUrl,candelete){
            const isExternal =this.$root.isExternalUrl({id_fiche:entryId,url:entryUrl})
            return this.getTemplateFromSlot(
                'adminsbuttons',
                {
                    entryId:'entryId',
                    entryTitle:'entryTitle',
                    entryUrl:'entryUrl',
                    isExternal,
                    candelete: [true,'true'].includes(candelete)
                }
            ).replace(/entryId/g,entryId)
            .replace(/entryTitle/g,entryTitle)
            .replace(/entryUrl/g,entryUrl)
        },
        async getColumns(){
            if (this.columns.length == 0){
                const fields = await this.waitFor('fields')
                const params = await this.waitFor('params');
                let columnfieldsids = this.sanitizedParam(params,this.isAdmin,'columnfieldsids')
                let defaultcolumnwidth = this.sanitizedParam(params,this.isAdmin,'defaultcolumnwidth')
                if (columnfieldsids.every((id)=>id.length ==0)){
                    // backup
                    columnfieldsids = ['bf_titre']
                }
                const data = {columns:[]}
                const width = defaultcolumnwidth.length > 0 ? {width:defaultcolumnwidth}: {}
                if (this.sanitizedParam(params,this.isAdmin,'displayadmincol')){
                    const uuid = this.getUuid()
                    data.columns.push({
                        ...{
                            data: '==canDelete==',
                            class: 'not-export-this-col',
                            orderable: false,
                            render: (data,type,row)=>{
                                return type === 'display' ? this.getDeleteChekbox(uuid,row.id_fiche,!data) : ''
                            },
                            title: this.getDeleteChekboxAll(uuid,'top'),
                            footer: this.getDeleteChekboxAll(uuid,'bottom')
                        },
                        ...width
                    })
                    data.columns.push({
                        ...{
                            data: '==adminsbuttons==',
                            orderable: false,
                            class: 'horizontal-admins-btn not-export-this-col',
                            render: (data,type,row)=>{
                                return type === 'display' ? this.getAdminsButtons(row.id_fiche,row.bf_titre || '',row.url || '',row['==canDelete==']) : ''
                            },
                            title: '',
                            footer: ''
                        },
                        ...width
                    })
                }
                const options={
                    checkboxfieldsincolumns: this.sanitizedParam(params,this.isAdmin,'checkboxfieldsincolumns'),
                    columnswidth: this.sanitizedParam(params,this.isAdmin,'columnswidth'),
                    defaultcolumnwidth,
                    sumfieldsids: this.sanitizedParam(params,this.isAdmin,'sumfieldsids'),
                    visible:true,
                    printable:true,
                    addLink:false
                }
                columnfieldsids.forEach((id,idx)=>{
                    if (id.length >0 && id in fields){
                        this.registerField(data,{
                            ...options,
                            ...{
                                field:fields[id],
                                visible:true,
                                printable:true,
                                addLink:idx === 0 && !('bf_titre' in columnfieldsids)
                            }
                        })
                    }
                })
                if (await this.sanitizedParamAsync('exportallcolumns')){
                    Object.keys(fields).forEach((id)=>{
                        // append fields not displayed
                        if (!columnfieldsids.includes(id)){
                            this.registerField(data,{
                                ...options,
                                ...{
                                    field:fields[id],
                                    visible:false,
                                    printable:false,
                                    addLink:false
                                }
                            })
                        }
                    })
                }

                [
                    ['displaycreationdate','date_creation_fiche','creationdatetranslate'],
                    ['displaylastchangedate','date_maj_fiche','modifiydatetranslate'],
                    ['displayowner','owner','ownertranslate']
                ].forEach(([paramName,propertyName,slotName])=>{
                    if (this.sanitizedParam(params,this.isadmin,paramName)){
                        data.columns.push({
                            data: propertyName,
                            title: this.getTemplateFromSlot(slotName,{}),
                            footer: ''
                        })
                    }
                })
                this.columns = data.columns
            }
            return this.columns
        },
        async getCsrfDeleteToken(entryId){
            return await this.getJson(wiki.url(`?api/pages/${entryId}/delete/getToken`))
            .then((json)=>('token' in json && typeof json.token === 'string') ? json.token : 'error')
        },
        async getCsrfDeleteTokens(entriesIds){
            return await this.getJson(wiki.url(`?api/pages/example/delete/getTokens`,{pages:entriesIds.join(',')}))
            .then((json)=>('tokens' in json && typeof json.tokens === 'object') ? json.tokens : entriesIds.reduce((o, key) => ({ ...o, [key]: 'error'}), {}))
        },
        getDatatableOptions(){
            const buttons = []
            DATATABLE_OPTIONS.buttons.forEach((option) => {
              buttons.push({
                ...option,
                ...{ footer: true },
                ...{
                  exportOptions: (
                    option.extend != 'print'
                      ? {
                        orthogonal: 'sort', // use sort data for export
                        columns(idx, data, node) {
                          return !$(node).hasClass('not-export-this-col')
                        }
                      }
                      : {
                        columns(idx, data, node) {
                          const isVisible = $(node).data('visible')
                          return !$(node).hasClass('not-export-this-col') && (
                            isVisible == undefined || isVisible != false
                          ) && !$(node).hasClass('not-printable')
                        }
                      })
                }
              })
            })
            return {
                ...DATATABLE_OPTIONS,
                ...{
                  footerCallback: ()=>{
                    this.updateFooter()
                  },
                  buttons
                }
              }
        },
        async getDatatable(){
            if (this.dataTable === null){
                // create dataTable
                const columns = await this.getColumns()
                const sumfieldsids = await this.sanitizedParamAsync('sumfieldsids')
                let firstColumnOrderable = 0
                for (let index = 0; index < columns.length; index++) {
                    if ('orderable' in columns[index]  && !columns[index].orderable){
                        firstColumnOrderable += 1
                    } else {
                        break
                    }
                }
                this.dataTable = $(this.$refs.dataTable).DataTable({
                    ...this.getDatatableOptions(),
                    ...{
                        columns: columns,
                        "scrollX": true,
                        order: [[firstColumnOrderable,'asc']]
                    }
                })
                $(this.dataTable.table().node()).prop('id',this.getUuid())
                this.dataTable.on('draw', () => {
                    this.updateNBResults()
                })
                if (sumfieldsids.length > 0 || this.sanitizedParamAsync('displayadmincol')){
                    this.initFooter(columns,sumfieldsids)
                }
            }
            return this.dataTable
        },
        getDeleteChekbox(targetId,itemId,disabled = false){
            return this.getTemplateFromSlot(
                'deletecheckbox',
                {targetId:'targetId',itemId:'itemId',disabled}
            ).replace(/targetId/g,targetId)
            .replace(/itemId/g,itemId)
        },
        getDeleteChekboxAll(targetId,selectAllType){
            return this.getTemplateFromSlot('deletecheckboxall',{})
                .replace(/targetId/g,targetId)
                .replace(/selectAllType/g,selectAllType)
        },
        async getJson(url){
            return await fetch(url)
                .then((response)=>{
                    if (response.ok){
                        return response.json()
                    } else {
                        throw new Error(`reponse was not ok when getting "${url}"`)
                    }
                })
        },
        getTemplateFromSlot(name,params){
            const key = name+'-'+JSON.stringify(params)
            if (!(key in this.templatesForRendering)){
                if (name in this.$scopedSlots){
                    const slot = this.$scopedSlots[name]
                    const constructor = Vue.extend({
                        render: function(h){
                            return h('div',{},slot(params))
                        }
                    })
                    const instance = new constructor()
                    instance.$mount()
                    let outerHtml = '';
                    for (let index = 0; index < instance.$el.childNodes.length; index++) {
                        outerHtml += instance.$el.childNodes[index].outerHTML || instance.$el.childNodes[index].textContent
                    }
                    this.templatesForRendering[key] = outerHtml
                } else {
                    this.templatesForRendering[key] = ''
                }
            }
            return this.templatesForRendering[key]
        },
        getUuid(){
            if (this.uuid === null){
                this.uuid = crypto.randomUUID()
            }
            return this.uuid
        },
        initFooter(columns,sumfieldsids){
            const footer = $('<tr>')
            let displayTotal = sumfieldsids.length > 0
            columns.forEach((col)=>{
                if ('footer' in col && col.footer.length > 0){
                    const element = $(col.footer)
                    const isTh = $(element).prop('tagName') === 'TH'
                    footer.append(isTh ? element : $('<th>').append(element))
                } else if (displayTotal) {
                    displayTotal = false
                    footer.append($('<th>').text(this.getTemplateFromSlot('sumtranslate',{})))
                } else {
                    footer.append($('<th>'))
                }
            })
            this.dataTable.footer().to$().html(footer)
        },
        manageError(error){
            if (wiki.isDebugEnabled){
                console.error(error)
            }
            return null
        },
        registerField(data,{
                field,
                checkboxfieldsincolumns=false,
                sumfieldsids=[],
                visible=true,
                printable=true,
                addLink=false,
                columnswidth={},
                defaultcolumnwidth=''
            }){
            if (typeof field.propertyname === 'string' && field.propertyname.length > 0){
                const className = (printable ? '' : 'not-printable')+(sumfieldsids.includes(field.propertyname) ? ' sum-activated': '')
                const width = field.propertyname in columnswidth ? {width:columnswidth[field.propertyname]} : (defaultcolumnwidth.length > 0 ? {width:defaultcolumnwidth}: {})
                if (typeof field.type === 'string' && field.type === 'map'){
                    data.columns.push({
                        ...{
                            class: className,
                            data: field.latitudeField,
                            title: this.getTemplateFromSlot('latitudetext',{}),
                            firstlevel: field.propertyname,
                            footer: '',
                            visible
                        },
                        ...width
                    })
                    data.columns.push({
                        ...{
                            class: className,
                            data: field.longitudeField,
                            title: this.getTemplateFromSlot('longitudetext',{}),
                            firstlevel: field.propertyname,
                            footer: '',
                            visible
                        },
                        ...width
                    })
                } else if (checkboxfieldsincolumns && 
                    typeof field.type === 'string' && 
                    ['checkboxfiche','checkbox'].includes(field.type) &&
                    typeof field.options == 'object') {
                    Object.keys(field.options).forEach((optionKey)=>{
                        data.columns.push({
                            ...{
                                class: className,
                                data: `${field.propertyname}-${optionKey}`,
                                title: `${field.label || field.propertyname} - ${field.options[optionKey] || optionKey}`,
                                checkboxfield: field.propertyname,
                                checkboxkey: optionKey,
                                footer: '',
                                visible
                            },
                            ...width
                        })
                    })
                } else {
                    data.columns.push({
                        ...{
                            class: className,
                            data: field.propertyname,
                            title: field.label || field.propertyname,
                            render: this.renderCell({addLink}),
                            footer: '',
                            visible
                        },
                        ...width
                    })
                }
            }
        },
        removeRows(dataTable,newIds){
            let entryIdsToRemove = Object.keys(this.displayedEntries).filter((id)=>!newIds.includes(id))
            entryIdsToRemove.forEach((id)=>{
                if (id in this.displayedEntries){
                    delete this.displayedEntries[id]
                }
            })
            dataTable.rows((idx,data,node)=>{
                return !('id_fiche' in data) || entryIdsToRemove.includes(data.id_fiche)
            }).remove()
        },
        resolve(name){
            this.isReady[name] = true
            if (name in this.cacheResolveReject &&
                Array.isArray(this.cacheResolveReject[name])){
                const listOfResolveReject = this.cacheResolveReject[name]
                this.cacheResolveReject[name] = []
                listOfResolveReject.forEach(({resolve})=>resolve(name in this ? this[name] : null))
            }
        },
        renderCell({fieldtype='',addLink=false}){
            const template = this.getTemplateFromSlot('rendercell',{anchorData:'anchorData',fieldtype,addLink,entryId:'entryIdAnchor',url:'anchorUrl'})
            return (data,type,row)=>{
                return template.replace(/anchorData/g,data.replace(/\n/g,'<br/>'))
                  .replace(/entryIdAnchor/g,row.id_fiche)
                  .replace(/anchorUrl/g,row.url)
            }
        },
        async sanitizedParamAsync(name){
            return this.sanitizedParam(await this.waitFor('params'),this.isadmin,name)
        },
        sanitizedParam(params,isAdmin,name){
            switch (name) {
                case 'displayadmincol':
                case 'displaycreationdate':
                case 'displaylastchangedate':
                case 'displayowner':
                    const paramValue = (
                            name in params && 
                            typeof params[name] === 'string' && 
                            ['yes','onlyadmins'].includes(params[name]))
                        ? params[name]
                        : false
                    switch (paramValue) {
                        case 'onlyadmins':
                            return [1,true,'1','true'].includes(isAdmin)
                        case 'yes':
                            return true
                        case false:
                        default:
                            return false
                    }
                case 'checkboxfieldsincolumns':
                    // default true
                    return name in params ? !([false,0,'0','false'].includes(params[name])) : true
                case 'displayvaluesinsteadofkeys':
                case 'exportallcolumns':
                case 'displayimagesasthumbnails':
                    // default false
                    return name in params ? [true,1,'1','true'].includes(params[name]) : false
                    
                case 'columnfieldsids':
                case 'columntitles':
                case 'sumfieldsids':
                    return (name in params && typeof params[name] === 'string')
                        ? params[name].split(',').map((v)=>v.trim())
                        : []
                case 'columnswidth':
                    const columnswidth = {}
                    if (
                        name in params && 
                        typeof params[name] === 'string'
                    ) {
                        params[name].split(',').forEach((extract)=>{
                            const [name,value] = extract.split('=',2)
                            if (name && value && name.length > 0 && value.length > 0){
                                columnswidth[name] = value
                            }
                        })
                    }
                    return columnswidth
                case 'defaultcolumnwidth':
                    return name in params ? String(params[name]) : ''
                default:
                    return params[name] || null
            }
        },
        sanitizeValue(val) {
          let sanitizedValue = val
          if (Object.prototype.toString.call(val) === '[object Object]') {
            // because if orthogonal data is defined, value is an object
            sanitizedValue = val.display || ''
          }
          return (isNaN(sanitizedValue)) ? 1 : Number(sanitizedValue)
        },
        startDelete(event){
            if (!multiDeleteService.isRunning) {
                multiDeleteService.isRunning = true
                const elem = event.target
                if (elem) {
                    $(elem).attr('disabled', 'disabled')
                    multiDeleteService.deleteItems(elem)
                }
            }
        },
        async updateEntries(newEntries,newIds){
            const columns = await this.getColumns()
            const dataTable = await this.getDatatable()
            const currentusername = await this.sanitizedParamAsync('currentusername')
            this.removeRows(dataTable,newIds)
            this.addRows(dataTable,columns,newEntries,currentusername,this.isadmin)
            this.dataTable.draw()
        },
        updateFieldsFromRoot(){
            this.fields = this.$root.formFields
            if (Object.keys(this.fields).length > 0){
                this.resolve('fields')
            }
        },
        updateNBResults(){
            // TODO
        },
        updateFooter(){
            if (this.dataTable !== null){
                const activatedRows = []
                this.dataTable.rows({ search: 'applied' }).every(function() {
                  activatedRows.push(this.index())
                })
                this.dataTable.columns('.sum-activated').every((indexCol) => {
                    let col = this.dataTable.column(indexCol)
                    let sum = 0
                    activatedRows.forEach((indexRow) => {
                      const value = this.dataTable.row(indexRow).data()[col.dataSrc()]
                      sum += this.sanitizeValue(Number(value))
                    })
                    this.dataTable.footer().to$().find(`> tr > th:nth-child(${indexCol+1})`).html(sum)
                })
            }
        },
        async waitFor(name){
            if (this.isReady[name]){
                return this[name] || null
            }
            if (!(name in this.cacheResolveReject)){
                this.cacheResolveReject[name] = []
            }
            const promise = new Promise((resolve,reject)=>{
                this.cacheResolveReject[name].push({resolve,reject})
            })
            return await promise.then((...args)=>Promise.resolve(...args)) // force .then()
        }
    },
    mounted(){
        $(isVueJS3 ? this.$el.parentNode : this.$el).on('dblclick',function(e) {
          return false;
        });
        this.updateFieldsFromRoot()
    },
    watch: {
        entries(newVal, oldVal) {
            this.updateFieldsFromRoot() // because updated in same time than entries (but not reactive)
            const newIds = newVal.map((e) => e.id_fiche)
            const oldIds = oldVal.map((e) => e.id_fiche)
            if (!this.arraysEqual(newIds, oldIds)) {
                this.updateEntries(newVal,newIds).catch(this.manageError)
            }
        },
        params() {
            this.resolve('params')
        },
        ready(){
            this.sanitizedParamAsync('displayadmincol').then((displayadmincol)=>{
                if (displayadmincol){
                    $(this.$refs.buttondeleteall).find(`#MultiDeleteModal${this.getUuid()}`).first().each(function(){
                        $(this).on('shown.bs.modal', function() {
                            multiDeleteService.initProgressBar($(this))
                            $(this).find('.modal-body .multi-delete-results').html('')
                            $(this).find('button.start-btn-delete-all').removeAttr('disabled')
                        })
                        $(this).on('hidden.bs.modal', function() {
                            multiDeleteService.modalClosing($(this))
                        })
                    })
                }
            }).catch(this.manageError)
        }
    },
    template: `
    <div>
        <slot name="header" v-bind="{displayedEntries,BazarTable:this}"/>
        <table ref="dataTable" class="table prevent-auto-init table-condensed display">
            <tfoot v-if="sanitizedParam(params,isadmin,'sumfieldsids').length > 0 || sanitizedParam(params,isadmin,'displayadmincol')">
                <tr></tr>
            </tfoot>
        </table>
        <div ref="buttondeleteall">
            <slot v-if="ready && sanitizedParam(params,isadmin,'displayadmincol')" name="deleteallselectedbutton" v-bind="{uuid:getUuid(),BazarTable:this}"/>
        </div>
        <slot name="spinnerloader" v-bind="{displayedEntries,BazarTable:this}"/>
        <slot name="footer" v-bind="{displayedEntries,BazarTable:this}"/>
    </div>
  `
};

if (isVueJS3){
    if (window.hasOwnProperty('bazarVueApp')){ // bazarVueApp must be defined into bazar-list-dynamic
        if (!bazarVueApp.config.globalProperties.hasOwnProperty('wiki')){
            bazarVueApp.config.globalProperties.wiki = wiki;
        }
        if (!bazarVueApp.config.globalProperties.hasOwnProperty('_t')){
            bazarVueApp.config.globalProperties._t = _t;
        }
        window.bazarVueApp.component(componentName,componentParams);
    }
} else {
    if (!Vue.prototype.hasOwnProperty('wiki')){
        Vue.prototype.wiki = wiki;
    }
    if (!Vue.prototype.hasOwnProperty('_t')){
        Vue.prototype._t = _t;
    }
    Vue.component(componentName,componentParams);
}