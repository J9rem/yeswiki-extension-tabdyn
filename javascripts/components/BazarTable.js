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
            forms: {},
            isReady:{
                isadmin: true,
                params: false
            },
            sumFieldsIds: [],
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
                    if (col.data === '==canDelete=='){
                        formattedData[col.data] = !this.$root.isExternalUrl(entry) && 
                            'owner' in entry &&
                            (isadmin || entry.owner == currentusername)
                    } else {
                        formattedData[col.data] = col.data in entry ? entry[col.data] : ''
                    }
                })
                formattedDataList.push(formattedData)
            })
            dataTable.rows.add(formattedDataList).draw()
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

            multiDeleteService.updateNbSelected(`MultiDeleteModal${this.getUuid()}`)
            // if something to do before showing modal (like get csrf token ?)
        },
        extractFormsIds(){
            return ('id' in this.params) ? this.params.id.split(',') : []
        },
        async getColumns(){
            if (this.columns.length == 0){
                const params = await this.waitFor('params')
                const displayadmincol = await this.sanitizedParamAsync('displayadmincol')
                const columns = []
                if (displayadmincol){
                    const uuid = this.getUuid()
                    columns.push({
                        data: '==canDelete==',
                        render: (data,type,row)=>{
                            return this.getDeleteChekbox(uuid,row.id_fiche,!data)
                        },
                        title: this.getDeleteChekboxAll(uuid,'top'),
                        footer: this.getDeleteChekboxAll(uuid,'bottom')
                    })
                }
                columns.push({
                    data: 'id_fiche',
                    title: 'id',
                    footer: ''
                })
                columns.push({
                    data: 'bf_titre',
                    title: 'Titre',
                    footer: ''
                })
                this.columns = columns
            }
            return this.columns
        },
        async getCsrfDeleteToken(entryId){
            return await fetch(wiki.url(`${entryId}/deletepage`))
                .then((response)=>{
                    if (response.ok){
                        return response.text()
                    } else {
                        throw new Error(`reponse was not ok when getting ${entryId}/deletepage`)
                    }
                })
                .then((html)=>{
                    const csrfTokenMatch = html.match(/name=\"csrf-token\" value=\"([^\"]*)\"/)
                    return (csrfTokenMatch[1] == undefined || csrfTokenMatch[1].length == 0) ? 'no-token' : csrfTokenMatch[1]
                })
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
                          )
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
                this.dataTable = $(this.$refs.dataTable).DataTable({
                    ...this.getDatatableOptions(),
                    ...{
                        columns: columns,
                        "scrollX": true
                    }
                })
                $(this.dataTable.table().node()).prop('id',this.getUuid())
                this.dataTable.on('draw', () => {
                    this.updateNBResults()
                })
                if (/*sumFieldsIds.length > 0 ||*/ this.sanitizedParamAsync('displayadmincol')){
                    this.initFooter(columns)
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
        getFormData(formId){
            if (this.isLocalFormId(formId)){
                return {
                    url: wiki.url(`?api/forms/${formId}`),
                    localFormId: formId
                }
            } else {
                const [baseUrl,rest] = formId.split('|',2)
                const externalFormId = (rest.match(/^([0-9]+)(?:->[0-9]+)?$/) || ['',''])[1]
                const localFormId = (rest.match(/^(?:[0-9]+->)([0-9]+)$/)|| ['',''])[1]
                return {
                    url: baseUrl+(baseUrl.slice(-1) === '?' ? '' : '?')+`api/forms/${externalFormId}`,
                    localFormId: (!localFormId || localFormId.length == 0) ? externalFormId : localFormId
                }
            }
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
                    this.templatesForRendering[key] = instance.$el.childNodes[0].outerHTML
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
        initFooter(columns){
            const footer = $('<tr>')
            columns.forEach((col)=>{
                if ('footer' in col && col.footer.length > 0){
                    const element = $(col.footer)
                    const isTh = $(element).prop('tagName') === 'TH'
                    footer.append(isTh ? element : $('<th>').append(element))
                } else {
                    footer.append($('<th>'))
                }
            })
            this.dataTable.footer().to$().html(footer)
        },
        isLocalFormId(formId){
            return String(formId) === String(Number(formId)) && formId.slice(0,4) !== 'http'
        },
        async loadForm(formId){
            const {url,localFormId} = this.getFormData(formId)
            return await fetch(url)
            .then((response)=>{
                if (!response.ok){
                    throw new Error(`Response was not ok when getting ${formId} from ${url}`)
                }
                return response.json()
            })
            .then((form)=>{
                this.forms[formId] = {...form,...{localFormId}}
                return form
            })
        },
        manageError(error){
            if (wiki.isDebugEnabled){
                console.error(error)
            }
            return null
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
            }).remove().draw()
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
        async sanitizedParamAsync(name){
            return await this.sanitizedParam(await this.waitFor('params'),await this.waitFor('isadmin'),name)
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
                case 'displayvaluesinsteadofkeys':
                case 'exportallcolumns':
                case 'displayimagesasthumbnails':
                    return name in params ? [true,1,'1','true'].includes(params[name]) : false
                    
                case 'columnswidth':
                    const columnswidth = {}
                    if (
                        name in params && 
                        typeof params[name] === 'string'
                    ) {
                        params[name].split(',').foreach((extract)=>{
                            const [name,value] = extract.split('=',2)
                            if (name && value && name.length > 0 && value.length > 0){
                                columnswidth[name] = value
                            }
                        })
                    }
                    return columnswidth
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
        updateColumns(form,canInit = false){
            if (this.columns.length > 0 || canInit){

            }
        },
        async updateEntries(newEntries,newIds){
            const columns = await this.getColumns()
            const dataTable = await this.getDatatable()
            const currentusername = await this.sanitizedParamAsync('currentusername')
            const isadmin = await this.waitFor('isadmin')
            this.removeRows(dataTable,newIds)
            this.addRows(dataTable,columns,newEntries,currentusername,isadmin)
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
                const activatedCols = []
                this.dataTable.columns('.sum-activated').every(function() {
                  activatedCols.push(this.index())
                })
                activatedCols.forEach((indexCol) => {
                  let sum = 0
                  activatedRows.forEach((indexRow) => {
                    const value = this.dataTable.row(indexRow).data()[indexCol]
                    sum += this.sanitizeValue(value)
                  })
                  // the folowwing line needs jQuery
                  $(this.dataTable.columns(indexCol).footer()).html(sum)
                })
            }
        },
        updateForms(){
            this.extractFormsIds().forEach((id,idx)=>{
                if (!(id in this.forms)){
                    this.forms[id] = {}
                    this.loadForm(id)
                        .then((form)=>{
                            this.updateColumns(form,(idx === 0))
                        })
                        .catch(this.manageError)
                }
            })
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
    },
    watch: {
        entries(newVal, oldVal) {
          const newIds = newVal.map((e) => e.id_fiche)
          const oldIds = oldVal.map((e) => e.id_fiche)
          if (!this.arraysEqual(newIds, oldIds)) {
            this.updateEntries(newVal,newIds).catch(this.manageError)
          }
        },
        isadmin() {
            this.resolve('isadmin')
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
            <tfoot v-if="sumFieldsIds.length > 0 || sanitizedParam(params,isadmin,'displayadmincol')">
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