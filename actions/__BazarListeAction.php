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

use YesWiki\Bazar\Service\FormManager;
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
                    in_array($arg['template'],['table','table.twig']) || 
                    (
                        in_array($arg['template'],['tableau','tableau.tpl.html']) &&
                        !empty($arg['dynamic']) && 
                        in_array($arg['dynamic'],[1,'on','true',true])
                    )
                )
            ) {
            $newArg['dynamic'] = true;
            $newArg['pagination'] = -1;
            $newArg['template'] = 'table';
            $currentUser = $this->getService(AuthController::class)->getLoggedUser();
            $currentUserName= empty($currentUser['name']) ? '' : $currentUser['name'];
            $newArg['currentusername'] = $currentUserName;
            if (empty($arg['columnfieldsids'])){
                $formId = empty($arg['id']) ? '1' : array_values(array_filter(explode(',',$arg['id']),function($id){
                    return strval($id) == strval(intval($id));
                }))[0];
                $form = $this->getService(FormManager::class)->getOne($formId);
                if (!empty($form['prepared'])){
                    $newArg['columnfieldsids'] = implode(',',array_map(function($field){
                        return $field->getPropertyName();
                    },array_filter($form['prepared'],function($field){
                        return !empty($field->getPropertyName());
                    })));
                }
            }
        } 
        return $newArg;
    }

    public function run()
    {
    }
}
