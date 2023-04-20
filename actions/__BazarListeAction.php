<?php

/*
 * This file is part of the YesWiki Extension tabdyn.
 *
 * Authors : see README.md file that was distributed with this source code.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace YesWiki\Tabdyn;

use Throwable;
use YesWiki\Bazar\Controller\EntryController;
use YesWiki\Bazar\Service\FormManager;
use YesWiki\Core\Service\Performer;
use YesWiki\Core\YesWikiAction;
use YesWiki\Core\Controller\AuthController;

class __BazarListeAction extends YesWikiAction
{
    public function formatArguments($arg)
    {
        $newArg = [];
        if (
                !empty($arg['template']) &&
                (
                    in_array($arg['template'],['map-and-table','table','table.twig']) || 
                    (
                        in_array($arg['template'],['tableau','tableau.tpl.html']) &&
                        !empty($arg['dynamic']) && 
                        in_array($arg['dynamic'],[1,'on','true',true])
                    )
                )
            ) {
            $newArg['dynamic'] = true;
            $newArg['pagination'] = -1;
            if ($arg['template'] != 'map-and-table'){
                $newArg['template'] = 'table';
            } else {
                try {
                    $vars = array_slice($arg,0);
                    $output = '';
                    $bazarCartoAction = $this->getService(Performer::class)->createPerformable([
                        'filePath' => 'tools/bazar/actions/BazarCartoAction.php',
                        'baseName' => 'BazarCartoAction'
                    ],
                    $vars,
                    $output);
                    $newArg = array_merge($newArg,$bazarCartoAction->formatArguments(array_merge(['dynamic'=>true],$arg)));
                    $newArg['template'] = 'map-and-table';
                    if (empty($arg['tablewith']) || $arg['tablewith'] !== 'only-geolocation'){
                        // Filters entries via query to remove whose withou bf_latitude nor bf_longitude
                        $query = $this->getService(EntryController::class)->formatQuery($newArg, $_GET);
                        foreach (['bf_latitude!','bf_longitude!'] as $key) {
                            if (array_key_exists($key,$query) && empty($query[$key])){
                                $query[$key] = 'not-empty-value-not-to-be-caugth';
                            }
                        }
                        $newArg['query'] = $query;
                    }
                } catch (Throwable $th) {
                    // do nothing
                }
            }
            $currentUser = $this->getService(AuthController::class)->getLoggedUser();
            $currentUserName= empty($currentUser['name']) ? '' : $currentUser['name'];
            $newArg['currentusername'] = $currentUserName;
            if (empty($arg['columnfieldsids'])){
                $this->appendAllFieldsIds($arg,$newArg,'columnfieldsids');
            } elseif ($this->formatBoolean($arg,false,'exportallcolumns')){
                $this->appendAllFieldsIds($arg,$newArg,'exportallcolumnsids');
            }
        } 
        return $newArg;
    }

    public function run()
    {
    }

    protected function appendAllFieldsIds(array $arg, array &$newArg,string $key){
        $formId = empty($arg['id']) ? '1' : array_values(array_filter(explode(',',$arg['id']),function($id){
            return strval($id) == strval(intval($id));
        }))[0];
        $form = $this->getService(FormManager::class)->getOne($formId);
        if (!empty($form['prepared'])){
            $newArg[$key] = implode(',',array_map(function($field){
                return $field->getPropertyName();
            },array_filter($form['prepared'],function($field){
                return !empty($field->getPropertyName());
            })));
        }
    }
}
