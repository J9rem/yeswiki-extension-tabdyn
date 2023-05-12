<?php

/*
 * This file is part of the YesWiki Extension tabdyn.
 *
 * Authors : see README.md file that was distributed with this source code.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace YesWiki\Tabdyn\Service;

use YesWiki\Aceditor\Service\ActionsBuilderService as AceditorActionsBuilderService;
use YesWiki\Core\Service\TemplateEngine;
use YesWiki\Wiki;

trait ActionsBuilderServiceCommon
{
    protected $previousData;
    protected $data;
    protected $parentActionsBuilderService;
    protected $renderer;
    protected $wiki;

    public function __construct(TemplateEngine $renderer, Wiki $wiki, $parentActionsBuilderService)
    {
        $this->data = null;
        $this->previousData = null;
        $this->parentActionsBuilderService = $parentActionsBuilderService;
        $this->renderer = $renderer;
        $this->wiki = $wiki;
    }

    public function setPreviousData(?array $data)
    {
        if (is_null($this->previousData)) {
            $this->previousData = is_array($data) ? $data : [];
            if ($this->parentActionsBuilderService && method_exists($this->parentActionsBuilderService, 'setPreviousData')) {
                $this->parentActionsBuilderService->setPreviousData($data);
            }
        }
    }

    // ---------------------
    // Data for the template
    // ---------------------
    public function getData()
    {
        if (is_null($this->data)) {
            if (!empty($this->parentActionsBuilderService)) {
                $this->data = $this->parentActionsBuilderService->getData();
            } else {
                $this->data = $this->previousData;
            }
            
            if (isset($this->data['action_groups']['bazarliste']['actions']['bazartableau']['properties']['columnfieldsids'])) {
                $this->data['action_groups']['bazarliste']['actions']['bazartableau']['properties']['columnfieldsids']['extraFields'] = [
                    'id_typeannonce',
                    'date_creation_fiche',
                    'date_maj_fiche'
                ];
            }

            if (isset($this->data['action_groups']['bazarliste']['actions']['commons']['properties']['dynamic']['showOnlyFor'])) {
                if (!in_array('bazartableau',$this->data['action_groups']['bazarliste']['actions']['commons']['properties']['dynamic']['showOnlyFor'])){
                    $this->data['action_groups']['bazarliste']['actions']['commons']['properties']['dynamic']['showOnlyFor'][] = 'bazartableau';
                }
            }

            // map-and-table
            
            if (isset($this->data['action_groups']['bazarliste']['actions'])) {
                if (!isset($this->data['action_groups']['bazarliste']['actions']['bazarmapandtable'])) {
                    $template = $this->data['action_groups']['bazarliste']['actions']['bazarcarto'] ?? [];
                    $bazartableautemplate = $this->data['action_groups']['bazarliste']['actions']['bazartableau'] ?? [];
                    $template['label'] = _t('TABDYN_AB_BAZAR_MAP_AND_TABLE_LABEL');
                    $template['properties'] = $template['properties'] ?? [];
                    $template['properties']['template']['value'] = 'map-and-table';
                    if (!empty($bazartableautemplate['properties'])){
                        foreach($bazartableautemplate['properties'] as $key => $value){
                            if ($key != 'template'){
                                $template['properties'][$key] = $value;
                            }
                        }
                    }
                    $template['properties']['tablewith'] = [
                        'type' => 'list',
                        'label' => _t('TABDYN_AB_BAZAR_MAP_AND_TABLE_TABLEWITH_LABEL'),
                        'default' => '',
                        'options' => [
                            '' => _t('TABDYN_AB_BAZAR_MAP_AND_TABLE_TABLEWITH_ALL'),
                            'only-geolocation' => _t('TABDYN_AB_BAZAR_MAP_AND_TABLE_TABLEWITH_ONLY_GEOLOC'),
                            'no-geolocation' => _t('TABDYN_AB_BAZAR_MAP_AND_TABLE_TABLEWITH_NO_GEOLOC')
                        ]
                    ];
                    $this->data['action_groups']['bazarliste']['actions']['bazarmapandtable'] = $template;
                }
                if (isset($this->data['action_groups']['bazarliste']['actions']['commons']['properties'])){
                    foreach($this->data['action_groups']['bazarliste']['actions']['commons']['properties'] as $key => $data){
                        if (!empty($data['showOnlyFor']) && is_array($data['showOnlyFor']) && 
                            in_array('bazarcarto',$data['showOnlyFor']) && !in_array('bazarmapandtable',$data['showOnlyFor'])){
                            $this->data['action_groups']['bazarliste']['actions']['commons']['properties'][$key]['showOnlyFor'][] = 'bazarmapandtable';
                        }
                    }
                }
            }
        }
        return $this->data;
    }
}

if (class_exists(AceditorActionsBuilderService::class, false)) {
    class ActionsBuilderService extends AceditorActionsBuilderService
    {
        use ActionsBuilderServiceCommon;
    }
} else {
    class ActionsBuilderService
    {
        use ActionsBuilderServiceCommon;
    }
}
