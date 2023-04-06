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

use YesWiki\Core\YesWikiAction;

class __BazarListeAction extends YesWikiAction
{
    public function formatArguments($arg)
    {
        $newArg = [];
        if (!empty($arg['template'])){
            if (in_array($arg['template'],['table','table.twig'])) {
                $newArg['dynamic'] = true;
                $newArg['pagination'] = -1;
            } elseif (in_array($arg['template'],['tableau','tableau.tpl.html']) &&
                !empty($arg['dynamic']) && in_array($arg['dynamic'],[1,'on','true',true])
                ){
                $newArg['dynamic'] = true;
                $newArg['pagination'] = -1;
                $newArg['template'] = 'table';
            }
        } 
        return $newArg;
    }

    public function run()
    {
    }
}
