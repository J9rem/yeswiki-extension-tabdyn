<?php

/*
 * This file is part of the YesWiki Extension tabdyn.
 *
 * Authors : see README.md file that was distributed with this source code.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace YesWiki\Tabdyn\Controller;

use Symfony\Component\Security\Csrf\CsrfTokenManager;
use Symfony\Component\Routing\Annotation\Route;
use YesWiki\Core\ApiResponse;
use YesWiki\Core\Service\PageManager;
use YesWiki\Core\YesWikiController;

class ApiController extends YesWikiController
{
    /**
     * @Route("/api/pages/{tag}/delete/getToken",methods={"GET"},options={"acl":{"public","+"}})
     */
    public function getDeleteToken($tag)
    {
        return new ApiResponse([
            'token'=>$this->regenerateToken($tag)
        ]);
    }

    /**
     * @Route("/api/pages/example/delete/getTokens",methods={"GET"},options={"acl":{"public","+"}})
     */
    public function getDeleteTokens()
    {
        $csrfTokenManager = $this->wiki->services->get(CsrfTokenManager::class);
        $pageManager = $this->wiki->services->get(PageManager::class);
        $pageIds = (empty($_GET['pages']) || !is_string($_GET['pages'])) ? [] : explode(',',strval($_GET['pages']));
        $tokens = [];
        foreach ($pageIds as $tag) {
            $tokens[$tag] = $this->regenerateToken($tag);
        }
        return new ApiResponse([
            'tokens'=>$tokens
        ]);
    }

    protected function regenerateToken(string $tag): string
    {
        $page = $this->wiki->services->get(PageManager::class)->getOne($tag);
        return (!empty($page) && ($this->wiki->UserIsAdmin() || $this->wiki->UserIsOwner($tag)))
            ? $this->wiki->services->get(CsrfTokenManager::class)->refreshToken("api\\pages\\$tag\\delete")->getValue()
            : 'not-authorized';
    }
}
