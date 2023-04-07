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
            paramsReady: false
        };
    },
    methods:{
        addRows(dataTable,columns,entries){
            const entriesToAdd = entries.filter((entry)=>!(entry.id_fiche in this.displayedEntries))
            let formattedDataList = []
            entriesToAdd.forEach((entry)=>{
                this.displayedEntries[entry.id_fiche] = entry
                let formattedData = {}
                columns.forEach((col)=>{
                    formattedData[col.data] = col.data in entry ? entry[col.data] : ''
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
        extractFormsIds(){
            return ('id' in this.params) ? this.params.id.split(',') : []
        },
        async getColumns(){
            if (this.columns.length == 0){
                const params = this.paramsReady ? this.params : await this.waitFor('params')
                this.columns = [
                    {
                        data: 'id_fiche',
                        title: 'id'
                    },
                    {
                        data: 'bf_titre',
                        title: 'Titre'
                    }
                ]
            }
            return this.columns
        },
        async getDatatable(){
            if (this.dataTable === null){
                // create dataTable
                const columns = await this.getColumns()
                this.dataTable = $(this.$refs.dataTable).DataTable({
                    ...DATATABLE_OPTIONS,
                    ...{
                        columns: columns,
                        "scrollX": true
                    }
                })
            }
            return this.dataTable
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
        resolveParams(){
            if (this.paramsReady && 'params' in this.cacheResolveReject &&
                Array.isArray(this.cacheResolveReject.params)){
                const listOfResolveReject = this.cacheResolveReject.params
                this.cacheResolveReject.params = []
                listOfResolveReject.forEach(({resolve})=>resolve(this.params))
            }
        },
        updateColumns(form,canInit = false){
            if (this.columns.length > 0 || canInit){

            }
        },
        async updateEntries(newEntries,newIds){
            const columns = await this.getColumns()
            const dataTable = await this.getDatatable()
            this.removeRows(dataTable,newIds)
            this.addRows(dataTable,columns,newEntries)
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
            if (!(name in this.cacheResolveReject)){
                this.cacheResolveReject[name] = []
            }
            const promise = new Promise((resolve,reject)=>{
                this.cacheResolveReject[name].push({resolve,reject})
            })
            return await promise.then((...args)=>Promise.resolve(...args)) // force .then
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
        params() {
            this.paramsReady = true
            this.resolveParams()
        },
    },
    template: `
    <div>
        <slot name="header" v-bind="{displayedEntries}"/>
        <table ref="dataTable" class="table-striped"></table>
        <slot name="spinnerloader" v-bind="{displayedEntries}"/>
        <slot name="footer" v-bind="{displayedEntries}"/>
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