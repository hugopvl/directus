define([
  'app',
  'backbone',
  'core/t',
  'core/BasePageView',
  'modules/messages/views/MessageView',
  'core/widgets/widgets',
  'moment'
],

function(app, Backbone, __t, BasePageView, MessageView, Widgets, moment) {

  var ListView = Backbone.Layout.extend({

    template: 'modules/messages/messages-list',

    attributes: {
      class: 'message-listing resize-left'
    },

    events: {
      'click .js-select-row': 'select',
      'click .js-message': function(event) {
        var id = $(event.currentTarget).data('id');
        var messageModel = this.collection.get(id);
        // app.router.go('#messages', id);
        if (messageModel) {
          this.state.currentMessage = messageModel;
          this.displayMessage(id, true);
        } else {
          console.warn('message with id: ' + id + ' does not exists.');
        }
      }
    },

    select: function() {
      this.collection.trigger('select');
    },

    state: {
      currentMessage: null,
      lastMessageId: null
    },

    serialize: function() {
      var self = this;
      var data = this.collection.map(function(model) {
        var data = model.toJSON();
        var momentDate = moment(data.date_updated);
        var currentMessage = self.state.currentMessage;
        var recipients;

        data.timestamp = parseInt(momentDate.format('X'), 10);
        data.niceDate = moment().diff(momentDate, 'days') > 1 ? momentDate.format('MMMM D') : momentDate.fromNow();
        data.read = model.getUnreadCount() === 0;
        data.responsesLength = data.responses.length;
        data.from = parseInt(data.from, 10);
        data.selected = currentMessage ? (currentMessage.get('id') === data.id) : false;

        if (data.recipients) {
          recipients = data.recipients.split(',');
        } else {
          recipients = [];
        }

        data.recipients = [];
        var extra = 0;

        for (var i=0; i<recipients.length; i++) {
          if (i > 2) {
            extra = recipients.length - i;
            break;
          }

          var user = app.users.get(recipients[i]);
          if (user !== undefined) {
            data.recipients.push(user.get('first_name'));
          }
        }

        data.recipients = data.recipients.join(", ");

        if (extra) {
          data.recipients += " (+"+extra+" more)";
        }

        //console.log(_.map(data.responses, 'from'));
        return data;
      });

      // Order the data by timestamp
      data = _.sortBy(data, function(item) {
        return -item.timestamp;
      });

      return {messages: data};
    },

    beforeRender: function() {
      var currentMessage = this.state.currentMessage;
      if (!currentMessage) {
        return;
      }

      if (this.collection.get(currentMessage)) {
        this.displayMessage(currentMessage);
      }
    },

    displayMessage: function(id, render) {
      var messageView = new MessageView({
        model: this.collection.get(id),
        parentView: this
      });

      this.setView('#message-content', messageView);

      if (render === true) {
        messageView.render();
      }
    },

    initialize: function() {
      // @TODO: Fix adding new messages
      // Getting a new message will re-render everything
      // clearing any message that it could be have writing.
      this.collection.on('sync', function() {
        if (this.state.lastMessageId != this.collection.maxId) {
          this.state.lastMessageId = this.collection.maxId;
          this.render();
        }
      }, this);
      this.state.lastMessageId = this.collection.maxId;
    }
  });

  return BasePageView.extend({

    headerOptions: {
      route: {
        title: __t('messages')
      }
    },

    leftToolbar: function() {
      var widgets = [
        new Widgets.ButtonWidget({
          widgetOptions: {
            buttonId: 'addBtn',
            iconClass: 'add',
            buttonClass: 'primary',
            buttonText: __t('message_compose')
          },
          onClick: function(event) {
            app.router.go('#messages', 'new');
          }
        })
      ];

      if (this.showDeleteButton) {
        widgets.push(new Widgets.ButtonWidget({
          widgetOptions: {
            buttonId: 'deleteBtn',
            iconClass: 'close',
            buttonClass: 'serious',
            buttonText: __t('delete')
          },
          onClick: _.bind(function(event) {
            // app.router.go('#tables/' + tableView.collection.table.id + '/new');
            var $checksChecked = this.table.$('.js-select-row:checked');
            var ids = [];
            _.each($checksChecked, function(checkbox) {
              ids.push($(checkbox).parent().data('id'));
            });

            var models = this.collection.filter(function(model) {
              return _.contains(ids, model.id);
            });

            if (models) {
              this.collection.destroy(models, {wait: true});
            }
          }, this)
        }));
      }

      return widgets;
    },
    rightToolbar: function() {
      return [
        //new Widgets.SearchWidget()
      ];
    },

    serialize: function() {
      return {
        title: 'Messages',
        buttonTitle: 'Compose'
      };
    },

    beforeRender: function() {
      var view = this.table = new ListView({collection: this.collection});
      this.setView('#page-content', view);
      BasePageView.prototype.beforeRender.call(this);
    },

    initialize: function() {
      this.collection.on('select', function() {
        var $checksChecked = this.table.$('.js-select-row:checked');
        // @NOTE: Hotfix render on empty selection
        var render = this.showDeleteButton && !($checksChecked.length >= 1);
        this.showDeleteButton = $checksChecked.length >= 1;

        if (render || this.showDeleteButton) {
          this.reRender();
        }
      }, this);

      // @TODO: This will render the view losing all the text that hasn't been sent yet
      this.collection.on('sync', this.render, this);
    }
  });
});
