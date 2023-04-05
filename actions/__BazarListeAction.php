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
        if (!empty($arg['template']) && in_array($arg['template'],['table','table.twig'])) {
            $newArg['dynamic'] = true;
            $newArg['pagination'] = -1;
        }
        return $newArg;
    }

    public function run()
    {
    }
}
