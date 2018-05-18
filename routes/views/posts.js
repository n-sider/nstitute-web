const keystone = require('keystone');

module.exports = (req, res) => {
  const view = new keystone.View(req, res);
  const { locals } = res;
  const { query: params } = req;
  const perPage = 10;
  locals.filters = [];

  view.on('init', (next) => {
    if (params.tags) {
      locals.currentTag = params.tags;
      keystone.list('Tag').model
        .findOne({ name: params.tags })
        .exec((err, result) => {
          if (err || !result) {
            locals.badFilter = true;
          } else {
            locals.filters.push({ field: 'tags', id: result['_id'], value: params.tags });
          }
          next();
        });
    } else {
      next();
    }
  });

  view.on('init', (next) => {
    if (params.authors) {
      keystone.list('User').model
        .findOne({
          'name.first': params.authors.split(' ')[0],
          'name.last': params.authors.split(' ').slice(1).join(' ')
        })
        .exec((err, result) => {
          if (err || !result) {
            locals.badFilter = true;
          } else {
            locals.filters.push({ field: 'authors', id: result['_id'], value: params.authors });
          }
          next();
        });
    } else {
      next();
    }
  });

  view.on('init', (next) => {
    locals.meta.title = 'nsidr | Posts';
    const page = Number(params.page || 1);
    let filterQuerystring = '';

    if (!locals.badFilter) {
      const posts = keystone.list('Post').model.find()
        .where('publishedDate').lt(new Date())
        .sort('-publishedDate')
        .skip(params.page ? params.page * perPage : 0)
        .limit(perPage);

      const countPosts = keystone.list('Post').model.find()
        .where('publishedDate').lt(new Date())
        .sort('-publishedDate');

      locals.filters.forEach((filter) => {
        posts.where(filter.field).in([filter.id]);
        countPosts.where(filter.field).in([filter.id]);
        filterQuerystring += `&${filter.field}=${filter.value}`;
      });

      posts.populate('authors tags').exec((err, result) => {
        if (result) {
          countPosts.count().exec((countErr, totalCount) => {
            locals.posts = result;
            locals.pagination = {
              prev: page > 1 ? `/posts?page=${page - 1}${filterQuerystring}` : undefined,
              current: page,
              next: (totalCount - ((page + 1) * perPage)) > 0 ?
                `/posts?page=${page + 1}${filterQuerystring}` : undefined
            };
            next();
          });
        } else {
          next(new Error('Posts not found'));
        }
      });
    } else {
      next();
    }
  });

  view.render((err) => {
    if (err) {
      return view.res.render('404', locals);
    }
    locals.scripts = [
      keystone.get('vue path'),
      '/scripts/lib/vue-resource.min.js',
      '/scripts/posts.js'
    ];
    return view.res.render('posts', locals);
  });
};