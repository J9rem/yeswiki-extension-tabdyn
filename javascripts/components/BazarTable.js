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
            dataTable: null,
            isMounted: false,
            paramsLoaded: false
        };
    },
    methods:{
        arraysEqual(a, b) {
            if (a === b) return true
            if (a == null || b == null || !Array.isArray(a) || !Array.isArray(b)) return false
            if (a.length !== b.length) return false
    
            a.sort()
            b.sort()
            return a.every((val,idx)=>a[idx] !== b[idx])
        },
        mountTable(){
            if (this.isMounted && this.dataTable === null && this.paramsLoaded) {
                this.dataTable = $(this.$refs.dataTable).DataTable({
                    ...DATATABLE_OPTIONS,
                    ...{
                        data: [
                            {
                                name: 'test1',
                                val: 'deux'
                            },
                            {
                                name: 'test2',
                                val: 'un'
                            }
                        ],
                        columns: [
                            {
                                data: 'name',
                                title: 'name'
                            },
                            {
                                data: 'val',
                                title: 'value'
                            }
                        ],
                        "scrollX": true
                    }
                })
            }
        },
    },
    mounted(){
        $(isVueJS3 ? this.$el.parentNode : this.$el).on('dblclick',function(e) {
          return false;
        });
        this.isMounted = true
        this.mountTable()
    },
    watch: {
        entries(newVal, oldVal) {
          const newIds = newVal.map((e) => e.id_fiche)
          const oldIds = oldVal.map((e) => e.id_fiche)
          if (!this.arraysEqual(newIds, oldIds)) {
          }
        },
        params() {
            this.paramsLoaded = true
            this.mountTable()
        },
    },
    template: `
    <div>
        <table ref="dataTable" class="table-striped"></table>
        <spinner-loader v-if="this.$root.isLoading || !ready" class="overlay super-overlay" :height="500"></spinner-loader>
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