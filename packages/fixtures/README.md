# @teranga/fixtures

Le catalogue de démonstration, **lu par le site et par l'API**.

Il vivait dans `apps/web/src/mocks/fixtures`. Deux copies auraient divergé le jour
où l'API aurait servi autre chose que ce que le site affichait — c'est déjà arrivé
une fois, avec un composant qui recopiait le catalogue à la main et annonçait
120 avis là où le catalogue en comptait 24.

Ces données ne sont pas des données de test : ce sont celles que montrent les
démonstrations et les vidéos. Les modifier change ce que le public voit.

Quand la base existera, l'API lira Postgres au lieu d'ici, et ce paquet ne servira
plus qu'aux semences (`seeds`) et aux tests.
