(function(){
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');
  if (burger && nav) {
    burger.addEventListener('click', function(){
      var open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', open);
    });
  }

  document.querySelectorAll('.qa .q').forEach(function(q){
    q.addEventListener('click', function(){
      q.parentElement.classList.toggle('open');
    });
  });
})();
