ROUTERS='find *  -type d'
for router in `$ROUTERS`
do
  cp $router/front.jpg $router.jpg
done
